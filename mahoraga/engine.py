"""Core Browser Use integration: build the LLM, the browser, and run tasks."""

from __future__ import annotations

import asyncio
import logging
import os
import shutil

from mahoraga.config import Settings

logger = logging.getLogger("mahoraga")

# Chromium locations tried in order when MAHORAGA_CHROMIUM_PATH is unset.
# Browser Use downloads its own Chromium otherwise, which sandboxed or
# offline environments can't always do.
_CHROMIUM_CANDIDATES = (
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
)


def _find_chromium() -> str | None:
    for candidate in _CHROMIUM_CANDIDATES:
        if os.path.isdir(candidate):
            # Playwright-style install dir: the binary lives inside chrome-linux/.
            nested = os.path.join(candidate, "chrome-linux", "chrome")
            if os.path.exists(nested):
                return nested
        elif os.path.exists(candidate):
            return candidate
    return shutil.which("chromium") or shutil.which("google-chrome")


def build_llm(settings: Settings):
    """Instantiate the Browser Use chat model for the configured provider."""
    provider = settings.provider
    model = settings.model
    if provider == "anthropic":
        from browser_use import ChatAnthropic

        return ChatAnthropic(model=model)
    if provider == "openai":
        from browser_use import ChatOpenAI

        return ChatOpenAI(model=model)
    if provider == "google":
        from browser_use import ChatGoogle

        return ChatGoogle(model=model)
    if provider == "browser-use":
        from browser_use import ChatBrowserUse

        return ChatBrowserUse(model=model)
    if provider == "groq":
        from browser_use import ChatGroq

        return ChatGroq(model=model)
    if provider == "ollama":
        from browser_use import ChatOllama

        return ChatOllama(model=model)
    raise ValueError(f"Unsupported provider: {provider}")


def build_browser(settings: Settings):
    """Create a BrowserSession, preferring a locally installed Chromium."""
    from browser_use import BrowserSession

    kwargs: dict = {
        "headless": settings.headless,
        # Root-owned containers can't use the Chromium sandbox.
        "chromium_sandbox": os.geteuid() != 0,
    }
    executable = settings.chromium_path or _find_chromium()
    if executable:
        kwargs["executable_path"] = executable
        logger.info("Using Chromium at %s", executable)
    return BrowserSession(**kwargs)


async def run_task_async(task: str, settings: Settings | None = None) -> str | None:
    """Run a natural-language browser task and return the agent's final answer."""
    settings = (settings or Settings()).resolve()
    from browser_use import Agent

    agent = Agent(
        task=task,
        llm=build_llm(settings),
        browser=build_browser(settings),
        use_vision=settings.use_vision,
    )
    history = await agent.run(max_steps=settings.max_steps)
    return history.final_result()


def run_task(task: str, settings: Settings | None = None) -> str | None:
    """Synchronous wrapper around :func:`run_task_async`."""
    return asyncio.run(run_task_async(task, settings))
