"""GNN pipeline stub.

Builds a distance-graph from atomic coordinates. Inference is unimplemented
until a PyTorch Geometric model is trained (see requirements-ml.txt).
"""

from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from typing import Any


@dataclass
class ProteinGraph:
    num_nodes: int
    num_edges: int
    cutoff_angstrom: float
    edges: list[tuple[int, int]]


class GNNPipeline:
    def __init__(self, cutoff_angstrom: float = 8.0) -> None:
        self.cutoff_angstrom = cutoff_angstrom

    def coords_to_graph(self, coords: list[list[float]]) -> ProteinGraph:
        n = len(coords)
        edges: list[tuple[int, int]] = []
        cutoff2 = self.cutoff_angstrom * self.cutoff_angstrom
        for i in range(n):
            xi, yi, zi = coords[i][0], coords[i][1], coords[i][2]
            for j in range(i + 1, n):
                dx = xi - coords[j][0]
                dy = yi - coords[j][1]
                dz = zi - coords[j][2]
                if dx * dx + dy * dy + dz * dz <= cutoff2:
                    edges.append((i, j))
        return ProteinGraph(
            num_nodes=n,
            num_edges=len(edges),
            cutoff_angstrom=self.cutoff_angstrom,
            edges=edges,
        )

    def infer(self, coords: list[list[float]]) -> dict[str, Any]:
        graph = self.coords_to_graph(coords)
        mean_degree = (2.0 * graph.num_edges / graph.num_nodes) if graph.num_nodes else 0.0
        return {
            "status": "unstubbed_model",
            "message": (
                "Graph constructed; no trained PyTorch Geometric weights are loaded. "
                "Install requirements-ml.txt and attach a model to enable inference."
            ),
            "num_nodes": graph.num_nodes,
            "num_edges": graph.num_edges,
            "cutoff_angstrom": graph.cutoff_angstrom,
            "mean_degree": round(mean_degree, 4),
            "radius_hint": round(sqrt(graph.num_nodes), 4) if graph.num_nodes else 0.0,
        }


gnn_pipeline = GNNPipeline()
