"""The live feed: sessions, events, the Browser Use hook adapters."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace as NS

import pytest

from mahoraga import live


def test_action_kind_folds_names():
    assert live.action_kind("click_element_by_index") == "click"
    assert live.action_kind("input_text") == "type"
    assert live.action_kind("go_to_url") == "navigate"
    assert live.action_kind("search") == "navigate"
    assert live.action_kind("scroll_down") == "scroll"
    assert live.action_kind("done") == "done"
    assert live.action_kind("switch_tab") == "switch"
    assert live.action_kind("extract_content") == "other"


def test_host_of():
    assert live.host_of("https://shop.example.com/a?b=1") == "shop.example.com"
    assert live.host_of("") == ""
    assert live.host_of(None) == ""


def _state(scroll_y=0.0):
    # absolute_position is page-relative (Browser Use adds the frame offsets to
    # the DOM snapshot bounds); the viewport is what the screenshot shows.
    node = NS(absolute_position=NS(x=100, y=200, width=300, height=40))
    return NS(
        url="https://example.com/",
        title="Example",
        tabs=[NS(target_id="T1", url="https://example.com/", title="Example")],
        dom_state=NS(selector_map={7: node}),
        page_info=NS(viewport_width=1000, viewport_height=800, scroll_x=0, scroll_y=scroll_y),
        screenshot=None,
    )


def test_bounds_are_viewport_fractions_and_scroll_aware():
    at = live._bounds(_state(), 7)
    assert at == {"x": 0.1, "y": 0.25, "w": 0.3, "h": 0.05}
    # The page has scrolled 200px: the element sits at the top of the viewport.
    assert live._bounds(_state(scroll_y=200), 7)["y"] == 0.0
    # Off-screen or unknown elements give nothing rather than a wrong tell.
    assert live._bounds(_state(scroll_y=5000), 7) is None
    assert live._bounds(_state(), 99) is None
    assert live._bounds(_state(), "nope") is None


class _Action:
    def __init__(self, **kw):
        self._kw = kw

    def model_dump(self, exclude_none=True):
        return self._kw


def test_actions_of_never_forwards_typed_text():
    output = NS(action=[
        _Action(click_element_by_index={"index": 7}),
        _Action(input_text={"index": 7, "text": "hunter2"}),
        _Action(go_to_url={"url": "https://example.com/login"}),
        _Action(done={"text": "finished", "success": True}),
    ])
    acts = live.actions_of(output, _state())
    assert [a["kind"] for a in acts] == ["click", "type", "navigate", "done"]
    assert acts[0]["at"]["w"] == 0.3
    assert acts[1]["chars"] == 7 and "text" not in acts[1]
    assert "hunter2" not in repr(acts)
    assert acts[2]["url"] == "https://example.com/login"
    assert acts[3]["success"] is True


def test_feed_session_lifecycle_and_events():
    feed = live.LiveFeed()
    q: asyncio.Queue = asyncio.Queue()
    feed._subs.add(q)
    s = feed.start("buy tea", "anthropic", "claude-sonnet-5")
    feed.page(s.id, "https://example.com/", "Example", [{"target": "T1", "url": "https://example.com/", "title": "Example"}])
    feed.page(s.id, "https://example.com/", "Example", [{"target": "T1", "url": "https://example.com/", "title": "Example"}])  # no change
    feed.step(s.id, 1, "open the cart", [{"name": "click", "kind": "click"}])
    feed.screenshot(s.id, b"\x89PNGabc", "image/png")
    feed.page(s.id, "https://example.com/cart", "Cart", [{"target": "T2", "url": "https://example.com/cart", "title": "Cart"}])
    feed.finish(s.id, "done: 2 items")
    feed.finish(s.id, "again")  # a second finish is ignored
    kinds = []
    while not q.empty():
        kinds.append(q.get_nowait()["kind"])
    assert kinds == [
        "task.started", "navigate", "tab.opened", "step", "screenshot",
        "navigate", "tab.opened", "tab.closed", "task.finished",
    ]
    snap = feed.snapshot()["sessions"][0]
    assert snap["status"] == "done" and snap["step"] == 1 and snap["screenshot"] == 1
    assert snap["host"] == "example.com" and snap["result"] == "done: 2 items"


def test_feed_forgets_old_finished_sessions():
    feed = live.LiveFeed()
    for i in range(live._KEEP_FINISHED + 3):
        s = feed.start(f"task {i}")
        feed.finish(s.id, None, success=False)
    running = feed.start("still going")
    assert len(feed.sessions) == live._KEEP_FINISHED + 1
    assert running.id in feed.sessions


def test_fail_records_error():
    feed = live.LiveFeed()
    s = feed.start("t")
    feed.fail(s.id, "boom")
    assert feed.get(s.id).status == "failed" and feed.get(s.id).error == "boom"


def test_stream_starts_with_a_snapshot_then_events():
    feed = live.LiveFeed()
    feed.start("first")

    async def run():
        gen = feed.stream()
        first = await gen.__anext__()
        s = feed.start("second")
        second = await gen.__anext__()
        await gen.aclose()
        return first, second, s

    first, second, s = asyncio.run(run())
    assert first.startswith("event: snapshot\n") and '"task":"first"' in first
    assert second.startswith("event: task.started\n") and s.id in second
    assert not feed._subs  # unsubscribed on close


def test_new_step_hook_reports_page_actions_and_screenshot():
    feed = live.LiveFeed()
    live.feed, saved = feed, live.feed
    try:
        s = feed.start("t")
        hooks = live.hooks(s.id)
        state = _state()
        state.screenshot = "iVBORw0KGgo="  # base64 of a PNG header
        output = NS(next_goal="open the cart", action=[_Action(click_element_by_index={"index": 7})])
        asyncio.run(hooks["agent"]["register_new_step_callback"](state, output, 3))
        sess = feed.get(s.id)
        assert sess.step == 3 and sess.goal == "open the cart" and sess.url == "https://example.com/"
        assert sess.shot_type == "image/png" and sess.shot.startswith(b"\x89PNG")
        assert [t["target"] for t in sess.tabs] == ["T1"]
    finally:
        live.feed = saved


def test_hooks_swallow_errors():
    feed = live.LiveFeed()
    live.feed, saved = feed, live.feed
    try:
        s = feed.start("t")
        hooks = live.hooks(s.id)
        asyncio.run(hooks["agent"]["register_new_step_callback"](None, None, "not a number"))
        asyncio.run(hooks["run"]["on_step_end"](NS(browser_session=None)))
        assert feed.get(s.id).status == "running"
    finally:
        live.feed = saved


@pytest.mark.parametrize("data,mime", [(b"\x89PNG....", "image/png"), (b"\xff\xd8\xff", "image/jpeg")])
def test_capture_uses_the_browser_session_api(data, mime):
    feed = live.LiveFeed()
    live.feed, saved = feed, live.feed
    try:
        s = feed.start("t")
        calls = []

        class Browser:
            async def get_current_page_url(self):
                return "https://example.com/x"

            async def get_current_page_title(self):
                return "X"

            async def get_tabs(self):
                return [NS(target_id="A", url="https://example.com/x", title="X")]

            async def take_screenshot(self, **kw):
                calls.append(kw)
                return data

        asyncio.run(live.capture(s.id, Browser()))
        sess = feed.get(s.id)
        assert sess.url == "https://example.com/x" and sess.shot == data and sess.shot_type == mime
        assert calls == [{"format": "jpeg", "quality": 55}]
    finally:
        live.feed = saved


# ── controls ─────────────────────────────────────────────────────────────────


class _Agent:
    def __init__(self):
        self.calls = []

    def pause(self):
        self.calls.append("pause")

    def resume(self):
        self.calls.append("resume")

    def stop(self):
        self.calls.append("stop")


def _drain(q):
    out = []
    while not q.empty():
        out.append(q.get_nowait())
    return out


def test_controls_reach_the_agent_and_emit():
    async def run():
        feed = live.LiveFeed()
        q: asyncio.Queue = asyncio.Queue()
        feed._subs.add(q)
        s = feed.start("t")
        agent = _Agent()
        feed.attach(s.id, agent)
        feed.control(s.id, "pause")
        feed.control(s.id, "pause")  # idempotent
        assert s.paused and not await _gate_open(feed, s.id)
        feed.control(s.id, "resume")
        assert not s.paused and await _gate_open(feed, s.id)
        feed.control(s.id, "stop")
        assert s.stopping and s.status == "running"  # the run ends on its own...
        feed.finish(s.id, None, success=False)  # ...and is then reported as stopped
        assert s.status == "stopped"
        kinds = [e["kind"] for e in _drain(q)]
        assert kinds == ["task.started", "task.paused", "task.resumed", "task.stopping", "task.finished"]
        assert agent.calls == ["pause", "resume", "stop"]
        assert feed.snapshot()["sessions"][0]["status"] == "stopped"

    asyncio.run(run())


async def _gate_open(feed, session_id):
    try:
        return await asyncio.wait_for(feed.gate(session_id), 0.05)
    except asyncio.TimeoutError:
        return False


def test_gate_returns_false_once_stopped():
    async def run():
        feed = live.LiveFeed()
        s = feed.start("replay")
        assert await feed.gate(s.id) is True
        feed.control(s.id, "pause")
        waiter = asyncio.create_task(feed.gate(s.id))
        await asyncio.sleep(0.02)
        assert not waiter.done()
        feed.control(s.id, "stop")  # releases the gate, and answers False
        assert await waiter is False

    asyncio.run(run())


def test_stop_without_an_agent_finishes_now_and_a_stop_error_is_still_a_stop():
    feed = live.LiveFeed()
    s = feed.start("external")
    feed.control(s.id, "stop")
    assert s.status == "stopped"
    ev = [e for e in feed.recent if e["kind"] == "task.finished"][-1]
    assert ev["stopped"] is True and ev["success"] is False

    s2 = feed.start("agent")
    feed.attach(s2.id, _Agent())
    feed.control(s2.id, "stop")
    feed.fail(s2.id, "InterruptedError: stopped")
    assert s2.status == "stopped"


def test_control_rejects_unknown_or_finished_sessions():
    feed = live.LiveFeed()
    with pytest.raises(LookupError):
        feed.control("nope", "pause")
    s = feed.start("t")
    with pytest.raises(ValueError):
        feed.control(s.id, "dance")
    feed.finish(s.id, "ok")
    with pytest.raises(ValueError):
        feed.control(s.id, "pause")


def test_control_routes():
    from fastapi.testclient import TestClient

    from mahoraga.server import create_app

    feed = live.LiveFeed()
    live.feed, saved = feed, live.feed
    try:
        client = TestClient(create_app())
        r = client.post("/v1/live/events", json={"kind": "task.started", "task": "route test"})
        sid = r.json()["session"]
        assert client.post(f"/v1/live/{sid}/pause").json()["paused"] is True
        assert client.post(f"/v1/live/{sid}/resume").json()["paused"] is False
        assert client.post(f"/v1/live/{sid}/dance").status_code == 404
        assert client.post("/v1/live/nope/pause").status_code == 404
        assert client.post(f"/v1/live/{sid}/stop").json()["status"] == "stopped"
        assert client.post(f"/v1/live/{sid}/pause").status_code == 409
        assert client.get("/v1/live/sessions").json()["sessions"][0]["status"] == "stopped"
    finally:
        live.feed = saved
