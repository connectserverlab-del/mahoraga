"""Mahoraga HTTP service.

Exposes the browser-automation engine over HTTP so orchestrators — the n8n
Workflow Engine in particular — can dispatch natural-language browser tasks.
Each task is executed by Browser Use, driving the browser through the
configured BrowserOS kernel (or a locally launched Chromium).

Run with:  mahoraga serve  [--host 0.0.0.0] [--port 8080]
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from mahoraga import live
from mahoraga.config import Settings
from mahoraga.engine import run_task_async
from mahoraga.wheel import Wheel, WheelStore, Workflow
from mahoraga.wheel.executor import WorkflowExecutor

logger = logging.getLogger("mahoraga")

API_KEY_ENV = "MAHORAGA_API_KEY"
CONSOLE_DIR = Path(__file__).parent / "console"


class TaskRequest(BaseModel):
    """A browser task submitted by a workflow step."""

    task: str = Field(..., description="What the agent should do, in plain English")
    provider: str | None = Field(None, description="LLM provider override")
    model: str | None = Field(None, description="Model name override")
    max_steps: int | None = Field(None, ge=1, le=500)
    use_vision: bool | None = None
    cdp_url: str | None = Field(
        None, description="BrowserOS kernel CDP URL override for this task"
    )


class TaskResponse(BaseModel):
    success: bool
    result: str | None = None
    error: str | None = None
    provider: str | None = None
    model: str | None = None
    kernel: str | None = None


class WheelRunRequest(BaseModel):
    """Run a task through the Wheel (recognize → replay-or-improvise → crystallize)."""

    task: str = Field(..., description="What to accomplish, in plain English")
    provider: str | None = None
    model: str | None = None
    max_steps: int | None = Field(None, ge=1, le=500)
    cdp_url: str | None = None


class WorkflowUpsert(BaseModel):
    """Create or replace a workflow from the console editor."""

    id: str | None = None
    name: str
    nodes: list[dict] = Field(default_factory=list)
    connections: list[dict] = Field(default_factory=list)
    signature: str = ""
    description: str = ""


class VaultAdd(BaseModel):
    """Save a site credential. The password is write-only — never returned."""

    domain: str
    username: str
    password: str
    notes: str = ""


class LiveEvent(BaseModel):
    """An event pushed into the live feed from outside the engine.

    Lets an integration (an n8n step, a test harness, another automation
    runner) drive the console's petal frames the same way the built-in agent
    does. ``task.started`` without a ``session`` opens a new session and
    returns its id; every other kind needs the ``session`` it belongs to.
    """

    kind: str = Field(..., description="task.started | step | navigate | screenshot | task.finished | task.failed | tab.opened | tab.closed")
    session: str | None = None
    task: str | None = None
    url: str | None = None
    title: str | None = None
    goal: str | None = None
    n: int | None = None
    actions: list[dict] = Field(default_factory=list)
    tabs: list[dict] | None = None
    target: str | None = None
    result: str | None = None
    success: bool | None = None
    error: str | None = None
    screenshot: str | None = Field(None, description="base64 (optionally a data: URL) PNG or JPEG")


async def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """Enforce the X-API-Key header when MAHORAGA_API_KEY is configured."""
    expected = os.environ.get(API_KEY_ENV)
    if expected and x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")


def _settings_from_request(req: TaskRequest) -> Settings:
    settings = Settings()
    if req.provider:
        settings.provider = req.provider
    if req.model:
        settings.model = req.model
    if req.max_steps:
        settings.max_steps = req.max_steps
    if req.use_vision is not None:
        settings.use_vision = req.use_vision
    if req.cdp_url:
        settings.cdp_url = req.cdp_url
    return settings.resolve()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mahoraga",
        version="0.1.0",
        summary="Adaptive web automation, driven through a BrowserOS kernel.",
    )

    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "mahoraga"}

    @app.post("/v1/tasks", response_model=TaskResponse)
    async def run(req: TaskRequest, _: None = Depends(require_api_key)) -> TaskResponse:
        try:
            settings = _settings_from_request(req)
        except SystemExit as exc:  # resolve() raises SystemExit on bad config
            return TaskResponse(success=False, error=str(exc))

        logger.info(
            "Running task via provider=%s model=%s kernel=%s",
            settings.provider,
            settings.model,
            settings.cdp_url or "local",
        )
        try:
            result = await run_task_async(req.task, settings)
        except Exception as exc:  # noqa: BLE001 — surface any engine failure
            logger.exception("Task failed")
            return TaskResponse(
                success=False,
                error=f"{type(exc).__name__}: {exc}",
                provider=settings.provider,
                model=settings.model,
                kernel=settings.cdp_url,
            )
        return TaskResponse(
            success=result is not None,
            result=result,
            provider=settings.provider,
            model=settings.model,
            kernel=settings.cdp_url,
        )

    # ── Wheel: adaptive automation ────────────────────────────────────────────

    @app.post("/v1/wheel/run")
    async def wheel_run(req: WheelRunRequest, _: None = Depends(require_api_key)) -> dict:
        settings = Settings()
        if req.provider:
            settings.provider = req.provider
        if req.model:
            settings.model = req.model
        if req.max_steps:
            settings.max_steps = req.max_steps
        if req.cdp_url:
            settings.cdp_url = req.cdp_url
        try:
            outcome = await Wheel(settings).run(req.task)
        except SystemExit as exc:
            return {"success": False, "error": str(exc)}
        except Exception as exc:  # noqa: BLE001
            logger.exception("Wheel run failed")
            return {"success": False, "error": f"{type(exc).__name__}: {exc}"}
        return outcome.to_dict()

    # ── Workflows: the crystallized adaptations ───────────────────────────────

    @app.get("/v1/workflows")
    async def list_workflows() -> dict:
        return {"workflows": [w.to_dict() for w in WheelStore().list()]}

    @app.get("/v1/workflows/{workflow_id}")
    async def get_workflow(workflow_id: str) -> dict:
        workflow = WheelStore().get(workflow_id)
        if workflow is None:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return workflow.to_dict()

    @app.post("/v1/workflows")
    async def upsert_workflow(
        body: WorkflowUpsert, _: None = Depends(require_api_key)
    ) -> dict:
        from datetime import datetime, timezone

        store = WheelStore()
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        workflow_id = body.id or (
            "wf_" + "".join(c for c in body.name.lower() if c.isalnum())[:16] or "wf_untitled"
        )
        existing = store.get(workflow_id)

        workflow = Workflow.from_dict(
            {
                "id": workflow_id,
                "name": body.name,
                "nodes": body.nodes,
                "connections": body.connections,
                "signature": body.signature,
                "description": body.description,
                "origin": existing.origin if existing else "manual",
                "created_at": existing.created_at if existing else now,
                "updated_at": now,
                "runs": existing.runs if existing else 0,
                "last_result": existing.last_result if existing else None,
            }
        )
        return store.save(workflow).to_dict()

    @app.delete("/v1/workflows/{workflow_id}")
    async def delete_workflow(
        workflow_id: str, _: None = Depends(require_api_key)
    ) -> dict:
        return {"deleted": WheelStore().delete(workflow_id)}

    @app.post("/v1/workflows/{workflow_id}/run")
    async def run_workflow(
        workflow_id: str, _: None = Depends(require_api_key)
    ) -> dict:
        store = WheelStore()
        workflow = store.get(workflow_id)
        if workflow is None:
            raise HTTPException(status_code=404, detail="Workflow not found")
        execution = await WorkflowExecutor(Settings()).run(workflow)
        workflow.runs += 1
        if isinstance(execution.result, str):
            workflow.last_result = execution.result
        store.save(workflow)
        return execution.to_dict()

    # ── Vault: saved site credentials ─────────────────────────────────────────

    @app.get("/v1/vault")
    async def list_vault(_: None = Depends(require_api_key)) -> dict:
        from mahoraga.vault import Vault

        return {"credentials": Vault().list()}  # metadata only, no passwords

    @app.post("/v1/vault")
    async def add_vault(body: VaultAdd, _: None = Depends(require_api_key)) -> dict:
        from datetime import datetime, timezone

        from mahoraga.vault import Vault

        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        entry = Vault().add(body.domain, body.username, body.password, body.notes, now=now)
        return entry.metadata()

    @app.delete("/v1/vault/{domain}")
    async def delete_vault(domain: str, _: None = Depends(require_api_key)) -> dict:
        from mahoraga.vault import Vault

        return {"deleted": Vault().delete(domain)}

    # ── Live feed: what the agent is doing, for the console ──────────────────

    @app.get("/v1/live")
    async def live_stream() -> StreamingResponse:
        """Server-Sent Events: a snapshot of every session, then each event."""
        return StreamingResponse(
            live.feed.stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    @app.get("/v1/live/sessions")
    async def live_sessions() -> dict:
        return live.feed.snapshot()

    @app.get("/v1/live/screenshot/{session_id}")
    async def live_screenshot(session_id: str) -> Response:
        session = live.feed.get(session_id)
        if session is None or not session.shot:
            raise HTTPException(status_code=404, detail="No frame yet")
        return Response(
            content=session.shot,
            media_type=session.shot_type,
            headers={"Cache-Control": "no-store", "X-Frame-Seq": str(session.shot_seq)},
        )

    @app.post("/v1/live/events")
    async def live_event(body: LiveEvent, _: None = Depends(require_api_key)) -> dict:
        kind = body.kind
        if kind == "task.started":
            session = live.feed.start(body.task or "external task", session_id=body.session)
            if body.url or body.tabs is not None:
                live.feed.page(session.id, body.url, body.title, body.tabs)
        else:
            session = live.feed.get(body.session or "")
            if session is None:
                raise HTTPException(status_code=404, detail="Unknown session")
            if kind == "step":
                live.feed.page(session.id, body.url, body.title, body.tabs)
                live.feed.step(session.id, body.n or session.step + 1, body.goal or "", body.actions, body.url, body.title)
            elif kind in ("navigate", "title"):
                live.feed.page(session.id, body.url, body.title, body.tabs)
            elif kind == "tab.opened":
                tabs = [t for t in session.tabs if t.get("target") != body.target]
                tabs.append({"target": body.target or "", "url": body.url or "", "title": body.title or ""})
                live.feed.page(session.id, None, None, tabs)
            elif kind == "tab.closed":
                live.feed.page(session.id, None, None, [t for t in session.tabs if t.get("target") != body.target])
            elif kind == "task.finished":
                live.feed.finish(session.id, body.result, success=body.success is not False)
            elif kind == "task.failed":
                live.feed.fail(session.id, body.error or "failed")
            elif kind != "screenshot":
                raise HTTPException(status_code=400, detail=f"Unknown event kind: {kind}")
        if body.screenshot:
            data = live._png_from_b64(body.screenshot)
            if data:
                mime = "image/png" if data[:4] == b"\x89PNG" else "image/jpeg"
                live.feed.screenshot(session.id, data, mime)
        return {"session": session.id, "seq": live.feed.snapshot()["seq"]}

    # ── Console UI ────────────────────────────────────────────────────────────

    assets_dir = CONSOLE_DIR / "assets"
    if assets_dir.is_dir():
        from fastapi.staticfiles import StaticFiles

        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def console() -> FileResponse:
        return FileResponse(CONSOLE_DIR / "index.html")

    @app.get("/petals")
    async def petals_prototype() -> FileResponse:
        """Standalone prototype of the petal-summon viewer; not part of the console yet."""
        return FileResponse(CONSOLE_DIR / "petals.html")

    # ── Map data for the petal map: streets, water and parks around a point ──
    # OpenStreetMap via Overpass, reverse-geocoded with Nominatim, projected to
    # local metres and thinned so the browser only has to place petals.
    _map_cache: dict[str, tuple[float, dict]] = {}

    @app.get("/map")
    async def map_around(lat: float, lon: float, radius: int = 900) -> dict:
        import math
        import time

        import httpx

        import json

        radius = max(150, min(int(radius), 2500))
        key = f"{lat:.3f},{lon:.3f},{radius}"
        hit = _map_cache.get(key)
        if hit and time.time() - hit[0] < 3600:
            return hit[1]
        # A disk cache too: Overpass is public and often busy, and a map you
        # have seen once should not depend on it being up the next time.
        cache_dir = Path(os.environ.get("MAHORAGA_HOME", str(Path.home() / ".mahoraga"))) / "map-cache"
        cache_file = cache_dir / (key.replace(",", "_") + ".json")
        if cache_file.is_file() and time.time() - cache_file.stat().st_mtime < 7 * 86400:
            try:
                cached = json.loads(cache_file.read_text())
                _map_cache[key] = (time.time(), cached)
                return cached
            except Exception:  # noqa: BLE001 - a bad cache file is just a miss
                pass

        minor = "|footway|cycleway|path|service|track" if radius <= 500 else ""
        highways = (
            "motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|"
            "tertiary|tertiary_link|residential|unclassified|living_street|pedestrian" + minor
        )
        query = f"""[out:json][timeout:25];(
          way(around:{radius},{lat},{lon})["highway"~"^({highways})$"];
          way(around:{radius},{lat},{lon})["waterway"~"^(river|stream|canal)$"];
          way(around:{radius},{lat},{lon})["natural"="water"];
          way(around:{radius},{lat},{lon})["leisure"~"^(park|garden)$"];
          way(around:{radius},{lat},{lon})["railway"="rail"];
        );out geom;"""
        headers = {"User-Agent": "mahoraga-console/0.1 (petal map prototype)"}
        data = None
        place = None
        async with httpx.AsyncClient(timeout=25, headers=headers) as client:
            for url in (
                "https://overpass-api.de/api/interpreter",
                "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
                "https://overpass.kumi.systems/api/interpreter",
            ):
                try:
                    r = await client.post(url, data={"data": query})
                    r.raise_for_status()
                    data = r.json()
                    break
                except Exception as exc:  # noqa: BLE001 - try the next mirror
                    logger.warning("overpass %s failed: %r", url, exc)
            if data is None:
                stale = cache_file if cache_file.is_file() else None
                if stale:
                    return json.loads(stale.read_text())
                raise HTTPException(status_code=502, detail="map data unavailable")
            try:
                r = await client.get(
                    "https://nominatim.openstreetmap.org/reverse",
                    params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 16, "accept-language": "en"},
                )
                if r.status_code == 200:
                    addr = r.json().get("address", {})
                    parts: list[str] = []
                    for k in ("neighbourhood", "suburb", "city_district", "city", "town", "village", "state", "country"):
                        v = addr.get(k)
                        if v and v not in parts:
                            parts.append(v)
                    place = ", ".join(parts[:3]) or None
            except Exception as exc:  # noqa: BLE001 - the name is a nicety
                logger.warning("nominatim failed: %s", exc)

        kx = 111_320 * math.cos(math.radians(lat))
        ky = 110_540
        ways = []
        for el in data.get("elements", []):
            tags = el.get("tags", {})
            geom = el.get("geometry") or []
            if len(geom) < 2:
                continue
            if "highway" in tags:
                h = tags["highway"].replace("_link", "")
                if h in ("motorway", "trunk", "primary"):
                    cls = "major"
                elif h in ("secondary", "tertiary"):
                    cls = "road"
                elif h in ("footway", "cycleway", "path", "service", "track", "pedestrian"):
                    cls = "minor"
                else:
                    cls = "street"
            elif "waterway" in tags or tags.get("natural") == "water":
                cls = "water"
            elif "leisure" in tags:
                cls = "park"
            elif "railway" in tags:
                cls = "rail"
            else:
                continue
            pts: list[list[float]] = []
            last = None
            for g in geom:
                x = (g["lon"] - lon) * kx
                y = (g["lat"] - lat) * ky
                if last is None or (x - last[0]) ** 2 + (y - last[1]) ** 2 >= 36:  # drop points under 6 m apart
                    pts.append([round(x, 1), round(y, 1)])
                    last = (x, y)
            if len(pts) >= 2:
                ways.append({"c": cls, "n": tags.get("name:en") or tags.get("name"), "p": pts})

        out = {"lat": lat, "lon": lon, "radius": radius, "place": place, "ways": ways,
               "attribution": "© OpenStreetMap contributors"}
        _map_cache[key] = (time.time(), out)
        try:
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps(out))
        except Exception as exc:  # noqa: BLE001 - the disk cache is best-effort
            logger.warning("map cache write failed: %s", exc)
        return out

    return app


def serve(host: str = "0.0.0.0", port: int = 8080) -> None:
    import uvicorn

    if os.environ.get(API_KEY_ENV):
        logger.info("Mahoraga API key auth is enabled")
    uvicorn.run(create_app(), host=host, port=port)
