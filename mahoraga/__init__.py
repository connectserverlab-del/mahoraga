"""Mahoraga — adaptive web automation powered by Browser Use."""

from mahoraga.config import Settings
from mahoraga.engine import run_task

__all__ = ["Settings", "run_task"]


def create_app():
    """Lazily build the FastAPI app (keeps server deps out of the import path)."""
    from mahoraga.server import create_app as _create_app

    return _create_app()
