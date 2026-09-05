"""Small dependency-free baseline for active learning over protein sequences.

This is intentionally a transparent baseline. It can be replaced by ESM/ProtT5
embeddings later without changing the training and feedback API.
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Any

AMINO_ACIDS = "ACDEFGHIKLMNPQRSTVWY"
HYDROPHOBIC = set("AVILMFWY")
CHARGED = set("DEKR")


def sequence_features(sequence: str) -> list[float]:
    sequence = "".join(sequence.upper().split())
    if not sequence or any(aa not in AMINO_ACIDS for aa in sequence):
        raise ValueError("sequence must contain only standard one-letter amino-acid codes")
    length = len(sequence)
    counts = [sequence.count(aa) / length for aa in AMINO_ACIDS]
    return counts + [
        min(length / 1000.0, 10.0),
        sum(aa in HYDROPHOBIC for aa in sequence) / length,
        sum(aa in CHARGED for aa in sequence) / length,
    ]


class SequenceRejuvenationModel:
    def __init__(self, artifact_path: str | None = None) -> None:
        self.artifact_path = artifact_path
        self.weights: list[float] = []
        self.toxicity_weights: list[float] = []
        self.residual: float = 1.0
        self.version: str | None = None
        if artifact_path and Path(artifact_path).exists():
            self._load(Path(artifact_path))

    def fit(self, examples: list[dict[str, Any]], version: str) -> dict[str, float]:
        if len(examples) < 2:
            raise ValueError("at least two training examples are required")
        features = [sequence_features(row["sequence"]) for row in examples]
        targets = [float(row["outcome"]) for row in examples]
        toxicity = [float(row.get("toxicity", 0.0)) for row in examples]
        self.weights = self._fit_linear(features, targets, examples)
        self.toxicity_weights = self._fit_linear(features, toxicity, examples)
        errors = [targets[i] - self._dot(self.weights, features[i]) for i in range(len(features))]
        self.residual = max(0.05, math.sqrt(sum(error * error for error in errors) / len(errors)))
        self.version = version
        return {"training_rmse": round(self.residual, 6)}

    def predict(self, sequence: str) -> dict[str, float | str]:
        if not self.weights or not self.version:
            raise ValueError("no trained model is loaded")
        values = sequence_features(sequence)
        benefit = self._clamp(self._dot(self.weights, values))
        toxicity = self._clamp(self._dot(self.toxicity_weights, values))
        uncertainty = min(1.0, self.residual + 0.15)
        return {
            "benefit_score": round(benefit, 6),
            "toxicity_risk": round(toxicity, 6),
            "uncertainty": round(uncertainty, 6),
            "ranking_score": round(benefit + 0.3 * uncertainty - toxicity, 6),
            "model_version": self.version,
        }

    def save(self, path: str | Path) -> None:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps(
                {
                    "version": self.version,
                    "weights": self.weights,
                    "toxicity_weights": self.toxicity_weights,
                    "residual": self.residual,
                }
            ),
            encoding="utf-8",
        )

    def _load(self, path: Path) -> None:
        data = json.loads(path.read_text(encoding="utf-8"))
        self.version = str(data["version"])
        self.weights = [float(value) for value in data["weights"]]
        self.toxicity_weights = [float(value) for value in data["toxicity_weights"]]
        self.residual = float(data["residual"])

    @staticmethod
    def _fit_linear(
        features: list[list[float]], targets: list[float], examples: list[dict[str, Any]]
    ) -> list[float]:
        dimension = len(features[0])
        weights = [0.0] * dimension
        for _ in range(600):
            gradients = [0.0] * dimension
            for values, target, example in zip(features, targets, examples):
                error = SequenceRejuvenationModel._dot(weights, values) - target
                scale = max(0.05, min(1.0, float(example.get("evidence_quality", 1.0))))
                for index, value in enumerate(values):
                    gradients[index] += scale * error * value
            for index in range(dimension):
                weights[index] -= 0.08 * gradients[index] / len(features)
        return weights

    @staticmethod
    def _dot(left: list[float], right: list[float]) -> float:
        return sum(a * b for a, b in zip(left, right))

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, value))


def default_artifact_path() -> Path:
    configured_dir = os.getenv("MODEL_DIR")
    if configured_dir:
        return Path(configured_dir) / "rejuvenation-baseline.json"
    return Path(__file__).resolve().parents[2] / "models" / "rejuvenation-baseline.json"
