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
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

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

    # ── Console UI ────────────────────────────────────────────────────────────

    assets_dir = CONSOLE_DIR / "assets"
    if assets_dir.is_dir():
        from fastapi.staticfiles import StaticFiles

        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def console() -> FileResponse:
        return FileResponse(CONSOLE_DIR / "index.html")

    return app


def serve(host: str = "0.0.0.0", port: int = 8080) -> None:
    import uvicorn

    if os.environ.get(API_KEY_ENV):
        logger.info("Mahoraga API key auth is enabled")
    uvicorn.run(create_app(), host=host, port=port)
