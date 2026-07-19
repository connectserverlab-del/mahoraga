"""The Wheel loop — recognize → replay-or-improvise → verify → crystallize.

This is the control loop that makes n8n-style automation *adaptive*: known
phenomena are replayed from crystallized workflows; novel ones are improvised
by the live agent and then crystallized so they become reflexes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

from mahoraga.config import Settings
from mahoraga.wheel.crystallize import crystallize
from mahoraga.wheel.executor import WorkflowExecutor
from mahoraga.wheel.models import Workflow
from mahoraga.wheel.signature import compute_signature
from mahoraga.wheel.store import WheelStore

logger = logging.getLogger("mahoraga")


@dataclass
class WheelOutcome:
    task: str
    signature: str
    path: str  # "replay" | "improvise"
    success: bool
    result: str | None = None
    workflow_id: str | None = None
    crystallized: bool = False
    node_results: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "task": self.task,
            "signature": self.signature,
            "path": self.path,
            "success": self.success,
            "result": self.result,
            "workflow_id": self.workflow_id,
            "crystallized": self.crystallized,
            "node_results": self.node_results,
        }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Wheel:
    def __init__(
        self, settings: Settings | None = None, store: WheelStore | None = None
    ) -> None:
        self.settings = settings or Settings()
        self.store = store or WheelStore()

    async def run(self, task: str) -> WheelOutcome:
        signature = compute_signature(task)
        known = self.store.find_by_signature(signature)

        if known is not None:
            logger.info("Wheel: recognized '%s' -> replaying %s", signature, known.id)
            return await self._replay(task, signature, known)

        logger.info("Wheel: new phenomenon '%s' -> improvising", signature)
        return await self._improvise(task, signature)

    async def _replay(self, task: str, signature: str, workflow: Workflow) -> WheelOutcome:
        executor = WorkflowExecutor(self.settings)
        execution = await executor.run(workflow)
        result = execution.result if isinstance(execution.result, str) else None

        workflow.runs += 1
        workflow.updated_at = _now()
        if result:
            workflow.last_result = result
        self.store.save(workflow)

        return WheelOutcome(
            task=task,
            signature=signature,
            path="replay",
            success=execution.ok,
            result=result,
            workflow_id=workflow.id,
            node_results=[n.to_dict() for n in execution.nodes],
        )

    async def _improvise(self, task: str, signature: str) -> WheelOutcome:
        from mahoraga.engine import run_task_async

        result = await run_task_async(task, self.settings)
        success = result is not None

        outcome = WheelOutcome(
            task=task,
            signature=signature,
            path="improvise",
            success=success,
            result=result,
        )

        # The wheel turns: crystallize only a verified (successful) solve.
        if success:
            workflow = crystallize(task, result, _now())
            self.store.save(workflow)
            outcome.workflow_id = workflow.id
            outcome.crystallized = True
            logger.info("Wheel: crystallized adaptation %s", workflow.id)

        return outcome
