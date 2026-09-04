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


def _proxy_args() -> list[str]:
    """Chromium ignores HTTP(S)_PROXY env vars; translate them to CLI flags."""
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if not proxy:
        return []
    args = [f"--proxy-server={proxy}"]
    no_proxy = os.environ.get("NO_PROXY") or os.environ.get("no_proxy")
    if no_proxy:
        bypass = ";".join(h.strip() for h in no_proxy.split(",") if h.strip())
        args.append(f"--proxy-bypass-list={bypass}")
    return args


def build_browser(settings: Settings, allowed_domains: list[str] | None = None):
    """Create a BrowserSession.

    When a BrowserOS kernel is configured (``settings.cdp_url``), attach to that
    already-running browser over CDP and let it own the browser lifecycle. This
    is the kernel boundary: Mahoraga drives pages but never launches or kills
    the browser. Otherwise, launch a local Chromium ourselves.

    ``allowed_domains`` locks the session to a set of domain patterns — used
    when vault credentials are injected, so secrets can't leak to other sites.
    """
    from browser_use import BrowserSession

    if settings.uses_kernel:
        logger.info("Attaching to BrowserOS kernel at %s", settings.cdp_url)
        # is_local=False keeps Browser Use from trying to manage (kill) a
        # browser process it did not start.
        kwargs: dict = {"cdp_url": settings.cdp_url, "is_local": False}
        if allowed_domains:
            kwargs["allowed_domains"] = allowed_domains
        return BrowserSession(**kwargs)

    kwargs = {
        "headless": settings.headless,
        # Root-owned containers can't use the Chromium sandbox.
        "chromium_sandbox": os.geteuid() != 0,
    }
    if allowed_domains:
        kwargs["allowed_domains"] = allowed_domains
    proxy_args = _proxy_args()
    if proxy_args:
        kwargs["args"] = proxy_args
        logger.info("Routing browser traffic through %s", proxy_args[0])
    executable = settings.chromium_path or _find_chromium()
    if executable:
        kwargs["executable_path"] = executable
        logger.info("Using Chromium at %s", executable)
    return BrowserSession(**kwargs)


def build_credentials(task: str) -> tuple[dict | None, list[str] | None, str | None]:
    """Assemble Browser Use ``sensitive_data`` + ``allowed_domains`` for a task.

    Looks up the vault for any site referenced by the task and returns
    domain-scoped credentials (the LLM only ever sees the ``vault_username`` /
    ``vault_password`` placeholders), the domain allow-list to lock the session
    to those sites, and a short instruction telling the agent to log in itself.
    Returns ``(None, None, None)`` when the vault has nothing for this task.
    """
    try:
        from mahoraga.vault import Vault

        entries = Vault().entries_for_task(task)
    except Exception as exc:  # noqa: BLE001 — vault must never break a run
        logger.debug("Vault lookup skipped: %s", exc)
        return None, None, None
    if not entries:
        return None, None, None

    sensitive: dict[str, dict[str, str]] = {}
    allowed: list[str] = []
    for entry in entries:
        for pattern in (f"https://{entry.domain}", f"https://*.{entry.domain}"):
            sensitive[pattern] = {
                "vault_username": entry.username,
                "vault_password": entry.password,
            }
            allowed.append(pattern)
    domains = ", ".join(e.domain for e in entries)
    hint = (
        f"You already have saved login credentials for: {domains}. "
        "If a login or sign-in form appears, fill the username field with "
        "vault_username and the password field with vault_password and submit — "
        "do NOT stop to ask the user to log in."
    )
    logger.info("Vault: injecting credentials for %s", domains)
    return sensitive, allowed, hint


async def run_task_async(task: str, settings: Settings | None = None) -> str | None:
    """Run a natural-language browser task and return the agent's final answer.

    If the vault holds credentials for a site the task references, they are
    injected so the agent logs in on its own instead of waiting for the user.
    """
    settings = (settings or Settings()).resolve()
    from browser_use import Agent

    from mahoraga import live

    sensitive, allowed, hint = build_credentials(task)
    # The console mirrors this run as a petal frame; it sees the task as
    # typed, never the credential hint.
    session = live.feed.start(task, settings.provider, settings.model)
    if hint:
        task = f"{task}\n\n{hint}"

    hooks = live.hooks(session.id)
    agent = Agent(
        task=task,
        llm=build_llm(settings),
        browser=build_browser(settings, allowed_domains=allowed),
        use_vision=settings.use_vision,
        sensitive_data=sensitive,
        **hooks["agent"],
    )
    live.feed.attach(session.id, agent)
    watcher = asyncio.create_task(
        live.watch(session.id, lambda: getattr(agent, "browser_session", None))
    )
    try:
        history = await agent.run(max_steps=settings.max_steps, **hooks["run"])
    except BaseException as exc:
        live.feed.fail(session.id, f"{type(exc).__name__}: {exc}")
        raise
    finally:
        watcher.cancel()

    # Mark which sites' credentials were used, for the vault's last-used stamp.
    if allowed:
        try:
            from datetime import datetime, timezone

            from mahoraga.vault import Vault

            vault = Vault()
            now = datetime.now(timezone.utc).isoformat(timespec="seconds")
            for entry in vault.entries_for_task(task):
                vault.touch(entry.domain, now)
        except Exception:  # noqa: BLE001
            pass

    result = history.final_result()
    live.feed.finish(session.id, result, success=result is not None)
    return result


def run_task(task: str, settings: Settings | None = None) -> str | None:
    """Synchronous wrapper around :func:`run_task_async`."""
    return asyncio.run(run_task_async(task, settings))
