from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass(frozen=True)
class FlareRiskConfig:
    """Configuration for a rules-based MS flare-risk score built on hrv_platform.db."""

    recent_measurement_days: int = 14
    recent_event_days: int = 14
    medication_adherence_days: int = 30
    symptom_recent_days: int = 5
    symptom_baseline_days: int = 30

    min_recent_points: int = 4
    min_baseline_points: int = 10

    medication_adherence_threshold: float = 0.85
    symptom_std_floor: float = 1.0

    # Heuristic weights must sum to 1.0
    weights: dict[str, float] = field(
        default_factory=lambda: {
            "hrv_component": 0.28,
            "trend_component": 0.20,
            "alert_component": 0.14,
            "anomaly_component": 0.14,
            "symptom_component": 0.16,
            "medication_component": 0.08,
        }
    )

    def __post_init__(self) -> None:
        required = {
            "hrv_component",
            "trend_component",
            "alert_component",
            "anomaly_component",
            "symptom_component",
            "medication_component",
        }
        actual = set(self.weights.keys())
        missing = required - actual
        extra = actual - required
        if missing or extra:
            raise ValueError(f"Invalid weight keys. Missing={missing}, Extra={extra}")

        total = sum(self.weights.values())
        if not np.isclose(total, 1.0):
            raise ValueError(f"Weights must sum to 1.0, got {total:.6f}")