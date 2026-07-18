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

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from mahoraga.config import Settings
from mahoraga.engine import run_task_async

logger = logging.getLogger("mahoraga")

API_KEY_ENV = "MAHORAGA_API_KEY"


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

    return app


def serve(host: str = "0.0.0.0", port: int = 8080) -> None:
    import uvicorn

    if os.environ.get(API_KEY_ENV):
        logger.info("Mahoraga API key auth is enabled")
    uvicorn.run(create_app(), host=host, port=port)
