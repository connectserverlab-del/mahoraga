"""Persistence for crystallized workflows — the Wheel's memory of adaptations.

Workflows are stored as one JSON file per workflow under a directory (default
``~/.mahoraga/wheel``). Simple, inspectable, and diff-friendly.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from mahoraga.wheel.models import Workflow


def default_wheel_dir() -> Path:
    configured = os.environ.get("MAHORAGA_WHEEL_DIR")
    if configured:
        return Path(configured).expanduser()
    return Path.home() / ".mahoraga" / "wheel"


class WheelStore:
    def __init__(self, directory: str | os.PathLike | None = None) -> None:
        self.dir = Path(directory) if directory else default_wheel_dir()
        self.dir.mkdir(parents=True, exist_ok=True)

    def _path(self, workflow_id: str) -> Path:
        # Guard against path traversal from an id.
        safe = workflow_id.replace("/", "_").replace("..", "_")
        return self.dir / f"{safe}.json"

    def list(self) -> list[Workflow]:
        items: list[Workflow] = []
        for path in sorted(self.dir.glob("*.json")):
            try:
                items.append(Workflow.from_dict(json.loads(path.read_text())))
            except (json.JSONDecodeError, KeyError):
                continue  # skip corrupt files rather than crash the whole list
        return items

    def get(self, workflow_id: str) -> Workflow | None:
        path = self._path(workflow_id)
        if not path.exists():
            return None
        return Workflow.from_dict(json.loads(path.read_text()))

    def save(self, workflow: Workflow) -> Workflow:
        self._path(workflow.id).write_text(json.dumps(workflow.to_dict(), indent=2))
        return workflow

    def delete(self, workflow_id: str) -> bool:
        path = self._path(workflow_id)
        if path.exists():
            path.unlink()
            return True
        return False

    def find_by_signature(self, signature: str) -> Workflow | None:
        if not signature:
            return None
        for workflow in self.list():
            if workflow.signature == signature:
                return workflow
        return None
