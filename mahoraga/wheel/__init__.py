"""The Wheel of Dharma — Mahoraga's native automation and adaptation layer.

Incorporates n8n-style workflow automation directly into Mahoraga: workflows
are graphs of typed nodes, stored as the durable form of what the agent has
learned. When Mahoraga meets a task it has already adapted to, the Wheel
*replays* a crystallized workflow; when it meets something new, it improvises
with the live agent and *crystallizes* the result into a new workflow.
"""

from mahoraga.wheel.models import Connection, Node, Workflow
from mahoraga.wheel.store import WheelStore
from mahoraga.wheel.wheel import Wheel

__all__ = ["Connection", "Node", "Workflow", "WheelStore", "Wheel"]
