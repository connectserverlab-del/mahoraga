"""Workflow executor — runs a Workflow graph node by node.

Deterministic node types (http, set, log, navigate, extract) run without an
LLM. The ``agent`` node hands off to the live Browser Use agent for the steps
that still need improvisation. Browser-driving nodes share one BrowserSession,
opened lazily and routed through the configured BrowserOS kernel.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any

import httpx

from mahoraga.config import Settings
from mahoraga.wheel.models import Node, Workflow

logger = logging.getLogger("mahoraga")

_TEMPLATE_RE = re.compile(r"\{\{\s*([\w.]+)\s*\}\}")


@dataclass
class NodeResult:
    node_id: str
    type: str
    ok: bool
    output: Any = None
    error: str | None = None

    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "type": self.type,
            "ok": self.ok,
            "output": self.output,
            "error": self.error,
        }


@dataclass
class ExecutionResult:
    ok: bool
    nodes: list[NodeResult] = field(default_factory=list)
    result: Any = None

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "result": self.result,
            "nodes": [n.to_dict() for n in self.nodes],
        }


def _render(value: Any, context: dict) -> Any:
    """Substitute {{node_id}} / {{node_id.field}} references from context."""
    if isinstance(value, str):
        def sub(match: re.Match) -> str:
            key = match.group(1)
            head, _, tail = key.partition(".")
            val = context.get(head)
            if tail and isinstance(val, dict):
                val = val.get(tail)
            return "" if val is None else str(val)

        return _TEMPLATE_RE.sub(sub, value)
    if isinstance(value, dict):
        return {k: _render(v, context) for k, v in value.items()}
    if isinstance(value, list):
        return [_render(v, context) for v in value]
    return value


class WorkflowExecutor:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        self._browser = None  # lazily created BrowserSession
        self._session = None  # the live-feed session while run() is active

    async def _ensure_browser(self):
        if self._browser is None:
            from mahoraga.engine import build_browser

            self._browser = build_browser(self.settings)
            await self._browser.start()
        return self._browser

    async def _close_browser(self) -> None:
        if self._browser is not None:
            try:
                await self._browser.stop()
            except Exception:  # noqa: BLE001
                pass
            self._browser = None

    async def run(self, workflow: Workflow) -> ExecutionResult:
        import asyncio

        from mahoraga import live

        context: dict = {}
        results: list[NodeResult] = []
        last_output: Any = None
        overall_ok = True
        failure: str | None = None

        # The console follows a replay the same way it follows a live agent:
        # one session, one step per node, frames from the shared browser.
        self._session = live.feed.start(workflow.name or workflow.id, self.settings.provider, self.settings.model)
        watcher = asyncio.create_task(live.watch(self._session.id, lambda: self._browser))
        try:
            for n, node in enumerate(workflow.execution_order(), start=1):
                if not await live.feed.gate(self._session.id):  # held while paused; False once stopped
                    overall_ok = False
                    break
                params = _render(node.params, context)
                live.feed.step(
                    self._session.id, n, params.get("task") or params.get("url") or node.type,
                    [{"name": node.type, "kind": live.action_kind(node.type), "url": params.get("url")}],
                )
                try:
                    output = await self._run_node(node, params, context)
                    context[node.id] = output
                    last_output = output
                    results.append(NodeResult(node.id, node.type, True, output))
                except Exception as exc:  # noqa: BLE001 — report, don't crash
                    overall_ok = False
                    failure = f"{type(exc).__name__}: {exc}"
                    results.append(NodeResult(node.id, node.type, False, error=failure))
                    logger.warning("Node %s (%s) failed: %s", node.id, node.type, exc)
                    break  # stop the chain on first failure
        finally:
            watcher.cancel()
            await self._close_browser()
            if failure:
                live.feed.fail(self._session.id, failure)
            else:
                live.feed.finish(
                    self._session.id, last_output if isinstance(last_output, str) else None, success=overall_ok
                )

        return ExecutionResult(ok=overall_ok, nodes=results, result=last_output)

    async def _run_node(self, node: Node, params: dict, context: dict) -> Any:
        handler = getattr(self, f"_node_{node.type}", None)
        if handler is None:
            raise ValueError(f"Unknown node type: {node.type}")
        return await handler(params, context)

    # ── node handlers ────────────────────────────────────────────────────────

    async def _node_set(self, params: dict, context: dict) -> Any:
        return params.get("value")

    async def _node_log(self, params: dict, context: dict) -> Any:
        message = params.get("message", "")
        logger.info("[workflow] %s", message)
        return message

    async def _node_http(self, params: dict, context: dict) -> Any:
        method = (params.get("method") or "GET").upper()
        url = params.get("url")
        if not url:
            raise ValueError("http node requires a 'url'")
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            resp = await client.request(
                method, url, headers=params.get("headers"), json=params.get("body")
            )
        content_type = resp.headers.get("content-type", "")
        body: Any = resp.json() if "application/json" in content_type else resp.text
        return {"status": resp.status_code, "body": body}

    async def _node_navigate(self, params: dict, context: dict) -> Any:
        url = params.get("url")
        if not url:
            raise ValueError("navigate node requires a 'url'")
        browser = await self._ensure_browser()
        await browser.new_page(url)
        if self._session is not None:
            from mahoraga import live

            await live.capture(self._session.id, browser)
        return {"url": url}

    async def _node_extract(self, params: dict, context: dict) -> Any:
        # Delegates to the live agent for a single extraction instruction, so it
        # works on any page without brittle selectors.
        instruction = params.get("instruction") or params.get("selector") or "the page text"
        return await self._node_agent(
            {"task": f"Extract {instruction} from the current page and return only that."},
            context,
        )

    async def _node_agent(self, params: dict, context: dict) -> Any:
        task = params.get("task")
        if not task:
            raise ValueError("agent node requires a 'task'")
        from browser_use import Agent

        from mahoraga import live
        from mahoraga.engine import build_llm

        settings = self.settings.resolve()
        browser = await self._ensure_browser()
        hooks = live.hooks(self._session.id) if self._session else {"agent": {}, "run": {}}
        agent = Agent(
            task=task,
            llm=build_llm(settings),
            browser_session=browser,
            use_vision=settings.use_vision,
            **hooks["agent"],
        )
        if self._session is not None:
            live.feed.attach(self._session.id, agent)
        try:
            history = await agent.run(max_steps=settings.max_steps, **hooks["run"])
        finally:
            if self._session is not None:
                live.feed.attach(self._session.id, None)
        return history.final_result()
