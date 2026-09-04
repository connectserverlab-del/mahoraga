"""The live feed: what the agent is doing right now, for the console.

Every task the service runs registers a *session* here. As the agent works,
the engine's hooks report each step (the page it is on, what it decided to do,
a screenshot), and the console mirrors that as a deck of petal frames: a task
starting summons a frame, a navigation ripples its border, typing sends petals
to the field, a finished task settles and dims.

Two surfaces:

* ``GET /v1/live`` — a Server-Sent Events stream. The first event is a
  ``snapshot`` of every session the feed still remembers, so a page that
  opens mid-task can catch up; after that, one event per thing that happens.
* ``GET /v1/live/screenshot/{session}`` — the latest frame of that session's
  current page, refetched whenever a ``screenshot`` event says it changed.
* ``POST /v1/live/{session}/pause|resume|stop`` — controls on a running
  task, reaching the Browser Use agent (or the replay executor) driving it.

Nothing here may break a run: every hook swallows its own errors.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import secrets
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, AsyncIterator
from urllib.parse import urlsplit

logger = logging.getLogger("mahoraga")

# How many finished sessions the snapshot keeps, and how long an SSE client
# waits between heartbeats.
_KEEP_FINISHED = 6
_HEARTBEAT = 15.0
_RESULT_CHARS = 400


def _now() -> float:
    return time.time()


def host_of(url: str | None) -> str:
    """``https://shop.example.com/a?b`` → ``shop.example.com``; blanks stay blank."""
    if not url:
        return ""
    try:
        return urlsplit(url).hostname or url
    except ValueError:
        return url


def action_kind(name: str) -> str:
    """Fold Browser Use's action names into the handful the console animates."""
    n = name.lower()
    if "click" in n:
        return "click"
    if "input" in n or "type" in n or "fill" in n:
        return "type"
    if n in ("done", "finish") or n.endswith("_done"):
        return "done"
    if "navigate" in n or "go_to" in n or "goto" in n or n in ("search", "open_tab", "open_url"):
        return "navigate"
    if "scroll" in n:
        return "scroll"
    if "switch" in n:
        return "switch"
    if "close" in n:
        return "close"
    if "key" in n:
        return "keys"
    return "other"


@dataclass
class LiveSession:
    id: str
    task: str
    status: str = "running"  # running | done | failed
    provider: str | None = None
    model: str | None = None
    url: str = ""
    title: str = ""
    step: int = 0
    goal: str = ""
    tabs: list[dict] = field(default_factory=list)
    result: str | None = None
    error: str | None = None
    started: float = field(default_factory=_now)
    finished: float | None = None
    shot: bytes | None = None
    shot_type: str = "image/jpeg"
    shot_seq: int = 0
    paused: bool = False
    stopping: bool = False
    agent: Any = None  # the Browser Use Agent driving this session, while it runs
    resume_event: asyncio.Event | None = None  # set while the session may proceed

    def to_dict(self) -> dict:
        return {
            "session": self.id,
            "task": self.task,
            "status": self.status,
            "paused": self.paused,
            "provider": self.provider,
            "model": self.model,
            "url": self.url,
            "title": self.title,
            "host": host_of(self.url),
            "step": self.step,
            "goal": self.goal,
            "tabs": self.tabs,
            "result": self.result,
            "error": self.error,
            "started": self.started,
            "finished": self.finished,
            "screenshot": self.shot_seq if self.shot else None,
        }


class LiveFeed:
    """An in-process event bus with SSE fan-out. One per service."""

    def __init__(self) -> None:
        self.sessions: dict[str, LiveSession] = {}
        self.recent: deque[dict] = deque(maxlen=300)
        self._subs: set[asyncio.Queue] = set()
        self._seq = 0

    # ── sessions ─────────────────────────────────────────────────────────

    def start(
        self, task: str, provider: str | None = None, model: str | None = None,
        session_id: str | None = None,
    ) -> LiveSession:
        session = LiveSession(
            id=session_id or ("ls_" + secrets.token_hex(4)), task=task, provider=provider, model=model
        )
        try:
            session.resume_event = asyncio.Event()
            session.resume_event.set()
        except RuntimeError:  # no event loop: replays gate on it, agents do not need it
            session.resume_event = None
        self.sessions[session.id] = session
        self._trim()
        self.emit("task.started", session.id, task=task, provider=provider, model=model)
        return session

    def get(self, session_id: str) -> LiveSession | None:
        return self.sessions.get(session_id)

    def finish(self, session_id: str, result: str | None, success: bool = True) -> None:
        s = self.sessions.get(session_id)
        if s is None or s.status != "running":
            return
        stopped = s.stopping
        s.status = "stopped" if stopped else "done" if success else "failed"
        s.finished = _now()
        s.paused = False
        s.agent = None
        s.result = (result or "")[:_RESULT_CHARS] or None
        self.emit(
            "task.finished", session_id, success=success and not stopped, stopped=stopped, result=s.result,
            steps=s.step, seconds=round(s.finished - s.started, 1),
        )

    def fail(self, session_id: str, error: str) -> None:
        s = self.sessions.get(session_id)
        if s is None or s.status != "running":
            return
        if s.stopping:  # a stop that surfaced as an error is still a stop
            self.finish(session_id, None, success=False)
            return
        s.status = "failed"
        s.finished = _now()
        s.paused = False
        s.agent = None
        s.error = error[:_RESULT_CHARS]
        self.emit("task.failed", session_id, error=s.error, steps=s.step)

    # ── controls: pause, resume, stop ────────────────────────────────────

    def attach(self, session_id: str, agent: Any) -> None:
        """Hand the feed the agent driving a session, so controls reach it."""
        s = self.sessions.get(session_id)
        if s is not None:
            s.agent = agent

    def control(self, session_id: str, action: str) -> LiveSession:
        """``pause`` holds the agent before its next step, ``resume`` lets it
        go on, ``stop`` ends the run (its frame settles as stopped).

        Raises ``LookupError`` for an unknown session and ``ValueError`` for
        one that is no longer running or an unknown action. A session that has
        no agent attached (one fed from outside) just records the state and
        emits the event; the integration is expected to honour it.
        """
        s = self.sessions.get(session_id)
        if s is None:
            raise LookupError(session_id)
        if s.status != "running":
            raise ValueError(f"session is {s.status}")
        if action == "pause":
            if not s.paused:
                s.paused = True
                if s.resume_event is not None:
                    s.resume_event.clear()
                _call(s.agent, "pause")
                self.emit("task.paused", session_id, step=s.step)
        elif action == "resume":
            if s.paused:
                s.paused = False
                if s.resume_event is not None:
                    s.resume_event.set()
                _call(s.agent, "resume")
                self.emit("task.resumed", session_id, step=s.step)
        elif action == "stop":
            if not s.stopping:
                s.stopping = True
                self.emit("task.stopping", session_id, step=s.step)
                if s.resume_event is not None:
                    s.resume_event.set()
                if s.agent is not None:
                    _call(s.agent, "stop")  # the run ends on its own; finish() reports it as stopped
                else:
                    self.finish(session_id, None, success=False)
        else:
            raise ValueError(f"unknown action: {action}")
        return s

    async def gate(self, session_id: str) -> bool:
        """For step-by-step runners: wait while paused; False once stopped."""
        s = self.sessions.get(session_id)
        if s is None:
            return True
        if s.resume_event is not None:
            await s.resume_event.wait()
        return not s.stopping

    def _trim(self) -> None:
        """Forget the oldest finished sessions once there are more than a few."""
        done = [s for s in self.sessions.values() if s.status != "running"]
        done.sort(key=lambda s: s.finished or 0)
        for s in done[: max(0, len(done) - _KEEP_FINISHED)]:
            self.sessions.pop(s.id, None)

    # ── what the agent reports ───────────────────────────────────────────

    def page(self, session_id: str, url: str | None, title: str | None, tabs: list[dict] | None = None) -> None:
        """The current page (and open tabs) changed; emits navigate / tab.* as needed."""
        s = self.sessions.get(session_id)
        if s is None:
            return
        url = url or ""
        title = title or ""
        if url and url != s.url:
            frm = s.url
            s.url, s.title = url, title
            self.emit("navigate", session_id, url=url, title=title, host=host_of(url), from_url=frm)
        elif title and title != s.title:
            s.title = title
            self.emit("title", session_id, url=s.url, title=title)
        if tabs is not None:
            self._tabs(s, tabs)

    def _tabs(self, s: LiveSession, tabs: list[dict]) -> None:
        old = {t.get("target"): t for t in s.tabs if t.get("target")}
        new = {t.get("target"): t for t in tabs if t.get("target")}
        for tid, t in new.items():
            if tid not in old:
                self.emit("tab.opened", s.id, target=tid, url=t.get("url", ""), title=t.get("title", ""), host=host_of(t.get("url")))
        for tid, t in old.items():
            if tid not in new:
                self.emit("tab.closed", s.id, target=tid, url=t.get("url", ""), title=t.get("title", ""))
        s.tabs = tabs

    def step(self, session_id: str, n: int, goal: str, actions: list[dict], url: str | None = None, title: str | None = None) -> None:
        s = self.sessions.get(session_id)
        if s is None:
            return
        s.step = n
        s.goal = goal or ""
        if url:
            s.url = url
        if title:
            s.title = title
        self.emit("step", session_id, n=n, goal=s.goal, actions=actions, url=s.url, title=s.title, host=host_of(s.url))

    def screenshot(self, session_id: str, data: bytes, mime: str = "image/jpeg") -> None:
        s = self.sessions.get(session_id)
        if s is None or not data:
            return
        s.shot, s.shot_type = data, mime
        s.shot_seq += 1
        self.emit("screenshot", session_id, seq=s.shot_seq, url=s.url)

    # ── the bus ──────────────────────────────────────────────────────────

    def emit(self, kind: str, session_id: str | None, **data: Any) -> dict:
        self._seq += 1
        event = {"kind": kind, "session": session_id, "seq": self._seq, "t": _now(), **data}
        self.recent.append(event)
        for q in list(self._subs):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:  # a stalled client; it will resync from the snapshot
                self._subs.discard(q)
        return event

    def snapshot(self) -> dict:
        return {"sessions": [s.to_dict() for s in self.sessions.values()], "seq": self._seq}

    async def stream(self) -> AsyncIterator[str]:
        """Server-Sent Events: a snapshot, then every event, with heartbeats."""
        q: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._subs.add(q)
        try:
            yield _sse("snapshot", self.snapshot())
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), _HEARTBEAT)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
                    continue
                yield _sse(event["kind"], event)
        finally:
            self._subs.discard(q)


def _call(obj: Any, method: str) -> None:
    fn = getattr(obj, method, None)
    if fn is None:
        return
    try:
        fn()
    except Exception as exc:  # noqa: BLE001
        logger.debug("live: agent.%s failed: %r", method, exc)


def _sse(kind: str, data: dict) -> str:
    return f"event: {kind}\ndata: {json.dumps(data, separators=(',', ':'))}\n\n"


feed = LiveFeed()


# ── Browser Use hooks ────────────────────────────────────────────────────────
# Everything below reads Browser Use objects defensively: attribute names have
# moved between releases, and a missing one must cost a detail, not the run.


def _get(obj: Any, *names: str, default: Any = None) -> Any:
    for n in names:
        if obj is None:
            break
        if isinstance(obj, dict):
            if n in obj:
                return obj[n]
            continue
        v = getattr(obj, n, None)
        if v is not None:
            return v
    return default


def _tabs_of(state_or_session: Any) -> list[dict]:
    out = []
    for t in _get(state_or_session, "tabs", default=[]) or []:
        out.append({
            "target": str(_get(t, "target_id", "page_id", "id", default="") or ""),
            "url": _get(t, "url", default="") or "",
            "title": _get(t, "title", default="") or "",
        })
    return out


def _bounds(state: Any, index: Any) -> dict | None:
    """Where an interactive element sits, as fractions of the viewport."""
    try:
        idx = int(index)
    except (TypeError, ValueError):
        return None
    dom = _get(state, "dom_state")
    node = (_get(dom, "selector_map", default={}) or {}).get(idx)
    rect = _get(node, "absolute_position", "bounds", "bounding_box", "rect")
    if rect is None:
        return None
    info = _get(state, "page_info")
    vw = float(_get(info, "viewport_width", default=0) or 0)
    vh = float(_get(info, "viewport_height", default=0) or 0)
    sx = float(_get(info, "scroll_x", default=0) or 0)
    sy = float(_get(info, "scroll_y", default=0) or 0)
    if vw <= 0 or vh <= 0:
        return None
    x = float(_get(rect, "x", default=0) or 0)
    y = float(_get(rect, "y", default=0) or 0)
    w = float(_get(rect, "width", "w", default=0) or 0)
    h = float(_get(rect, "height", "h", default=0) or 0)
    # absolute_position is page-relative; the screenshot shows the viewport.
    x -= sx
    y -= sy
    if y + h < 0 or y > vh or x + w < 0 or x > vw:
        return None
    r = lambda v: round(max(0.0, min(1.0, v)), 4)  # noqa: E731
    return {"x": r(x / vw), "y": r(y / vh), "w": r(w / vw), "h": r(h / vh)}


def actions_of(agent_output: Any, state: Any) -> list[dict]:
    """The step's actions as ``{name, kind, index?, at?, url?, chars?}``.

    Typed text is never forwarded (it may be a vault credential); only its
    length is.
    """
    out: list[dict] = []
    for act in _get(agent_output, "action", "actions", default=[]) or []:
        try:
            dumped = act.model_dump(exclude_none=True) if hasattr(act, "model_dump") else dict(act)
        except Exception:  # noqa: BLE001
            continue
        for name, params in dumped.items():
            if params is None:
                continue
            params = params if isinstance(params, dict) else {}
            entry: dict[str, Any] = {"name": name, "kind": action_kind(name)}
            if "index" in params:
                entry["index"] = params["index"]
                at = _bounds(state, params["index"])
                if at:
                    entry["at"] = at
            url = params.get("url") or params.get("query")
            if isinstance(url, str) and url:
                entry["url"] = url[:300]
            text = params.get("text")
            if isinstance(text, str):
                entry["chars"] = len(text)
            if entry["kind"] == "done":
                entry["success"] = bool(params.get("success", True))
            out.append(entry)
    return out


def _png_from_b64(data: Any) -> bytes | None:
    if not isinstance(data, str) or not data:
        return None
    if data.startswith("data:"):
        data = data.split(",", 1)[-1]
    try:
        return base64.b64decode(data)
    except Exception:  # noqa: BLE001
        return None


async def capture(session_id: str, browser: Any) -> None:
    """Take a fresh screenshot of the session's current page and report the page."""
    if browser is None:
        return
    try:
        url = await browser.get_current_page_url()
    except Exception:  # noqa: BLE001
        url = None
    try:
        title = await browser.get_current_page_title()
    except Exception:  # noqa: BLE001
        title = None
    try:
        tabs = _tabs_of({"tabs": await browser.get_tabs()})
    except Exception:  # noqa: BLE001
        tabs = None
    feed.page(session_id, url, title, tabs)
    try:
        data = await browser.take_screenshot(format="jpeg", quality=55)
    except TypeError:
        try:
            data = await browser.take_screenshot()
        except Exception:  # noqa: BLE001
            data = None
    except Exception:  # noqa: BLE001
        data = None
    if data:
        mime = "image/png" if bytes(data[:4]) == b"\x89PNG" else "image/jpeg"
        feed.screenshot(session_id, bytes(data), mime)


def hooks(session_id: str) -> dict:
    """Keyword arguments for ``Agent(...)`` and ``agent.run(...)``.

    ``register_new_step_callback`` fires once the model has decided a step,
    before the actions run: that is where the page state, the actions and the
    vision screenshot are. ``on_step_end`` fires after them and grabs a fresh
    frame, so the console sees the result of the step too.
    """

    async def on_new_step(state: Any, output: Any, n: int) -> None:
        try:
            url = _get(state, "url")
            title = _get(state, "title")
            goal = _get(output, "next_goal", default="") or ""
            feed.page(session_id, url, title, _tabs_of(state))
            feed.step(session_id, int(n), str(goal), actions_of(output, state), url, title)
            shot = _png_from_b64(_get(state, "screenshot"))
            if shot:
                feed.screenshot(session_id, shot, "image/png")
        except Exception as exc:  # noqa: BLE001
            logger.debug("live: step hook failed: %r", exc)

    async def on_step_end(agent: Any) -> None:
        try:
            await capture(session_id, _get(agent, "browser_session", "browser"))
        except Exception as exc:  # noqa: BLE001
            logger.debug("live: step-end hook failed: %r", exc)

    return {"agent": {"register_new_step_callback": on_new_step}, "run": {"on_step_end": on_step_end}}


async def watch(session_id: str, browser_getter: Any, every: float = 2.0) -> None:
    """Keep the frame live between steps: a screenshot every couple of seconds.

    Run as a task alongside ``agent.run`` and cancel it afterwards. A model
    step can take ten seconds or more; without this the console would only
    move when the agent does.
    """
    try:
        while True:
            await asyncio.sleep(every)
            browser = browser_getter() if callable(browser_getter) else browser_getter
            s = feed.get(session_id)
            if browser is None or s is None or s.status != "running":
                continue
            await capture(session_id, browser)
    except asyncio.CancelledError:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.debug("live: watcher stopped: %r", exc)
