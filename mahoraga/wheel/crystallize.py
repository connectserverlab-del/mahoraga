"""Crystallization — turning a successful improvisation into a workflow.

This is the wheel turning: a task the agent solved live becomes a stored,
named, replayable Workflow. The first-pass distillation is deliberately honest
about its limits — it captures the task as a single ``agent`` node so the
counter is reproducible immediately. Smarter distillation (generalizing a
recorded trajectory into deterministic nodes) can replace this without changing
callers.
"""

from __future__ import annotations

import hashlib

from mahoraga.wheel.models import Node, Workflow
from mahoraga.wheel.signature import compute_signature


def _slug(text: str, limit: int = 48) -> str:
    words = [w for w in text.lower().split() if w.isalnum()]
    return "-".join(words)[:limit] or "task"


def _workflow_id(signature: str) -> str:
    digest = hashlib.sha1(signature.encode()).hexdigest()[:10]
    return f"wf_{digest}"


def crystallize(task: str, result: str | None, timestamp: str) -> Workflow:
    """Distill a solved task into a first-pass crystallized workflow."""
    signature = compute_signature(task)
    node = Node(
        id="agent_1",
        type="agent",
        name="Adapted step",
        params={"task": task},
        position=[240, 120],
    )
    return Workflow(
        id=_workflow_id(signature),
        name=_slug(task).replace("-", " ").title() or "Adapted task",
        nodes=[node],
        connections=[],
        signature=signature,
        description=f"Crystallized from a solved task. Result preview: {(result or '')[:140]}",
        origin="crystallized",
        created_at=timestamp,
        updated_at=timestamp,
        runs=0,
        last_result=result,
    )
