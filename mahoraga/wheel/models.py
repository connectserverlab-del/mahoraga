"""Workflow data model — an n8n-flavored graph of typed nodes.

A Workflow is a directed graph: nodes do work, connections define order and
data flow. The shape is intentionally close to n8n's (nodes with a type +
params, connections between them) so the concepts transfer, without depending
on n8n itself.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Node types the executor knows how to run. Kept small and explicit.
NODE_TYPES = ("http", "navigate", "extract", "agent", "set", "log")


@dataclass
class Node:
    id: str
    type: str
    name: str = ""
    params: dict = field(default_factory=dict)
    position: list[int] = field(default_factory=lambda: [0, 0])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type,
            "name": self.name or self.type,
            "params": self.params,
            "position": self.position,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Node":
        return cls(
            id=d["id"],
            type=d["type"],
            name=d.get("name", ""),
            params=d.get("params", {}) or {},
            position=d.get("position", [0, 0]),
        )


@dataclass
class Connection:
    source: str  # node id
    target: str  # node id

    def to_dict(self) -> dict:
        return {"source": self.source, "target": self.target}

    @classmethod
    def from_dict(cls, d: dict) -> "Connection":
        return cls(source=d["source"], target=d["target"])


@dataclass
class Workflow:
    id: str
    name: str
    nodes: list[Node] = field(default_factory=list)
    connections: list[Connection] = field(default_factory=list)
    signature: str = ""
    description: str = ""
    origin: str = "manual"  # "manual" | "crystallized"
    created_at: str = ""
    updated_at: str = ""
    runs: int = 0
    last_result: str | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "nodes": [n.to_dict() for n in self.nodes],
            "connections": [c.to_dict() for c in self.connections],
            "signature": self.signature,
            "description": self.description,
            "origin": self.origin,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "runs": self.runs,
            "last_result": self.last_result,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Workflow":
        return cls(
            id=d["id"],
            name=d["name"],
            nodes=[Node.from_dict(n) for n in d.get("nodes", [])],
            connections=[Connection.from_dict(c) for c in d.get("connections", [])],
            signature=d.get("signature", ""),
            description=d.get("description", ""),
            origin=d.get("origin", "manual"),
            created_at=d.get("created_at", ""),
            updated_at=d.get("updated_at", ""),
            runs=d.get("runs", 0),
            last_result=d.get("last_result"),
        )

    def entry_nodes(self) -> list[Node]:
        """Nodes with no incoming connection — where execution starts."""
        targets = {c.target for c in self.connections}
        return [n for n in self.nodes if n.id not in targets]

    def outgoing(self, node_id: str) -> list[str]:
        return [c.target for c in self.connections if c.source == node_id]

    def execution_order(self) -> list[Node]:
        """Return nodes in a stable topological order.

        Falls back to declaration order for any nodes left unvisited (cycles or
        disconnected pieces), so execution never silently drops a node.
        """
        by_id = {n.id: n for n in self.nodes}
        order: list[Node] = []
        seen: set[str] = set()

        stack = list(reversed(self.entry_nodes()))
        while stack:
            node = stack.pop()
            if node.id in seen:
                continue
            seen.add(node.id)
            order.append(node)
            for target in self.outgoing(node.id):
                if target in by_id and target not in seen:
                    stack.append(by_id[target])

        for node in self.nodes:  # anything unreachable, appended in order
            if node.id not in seen:
                order.append(node)
        return order
