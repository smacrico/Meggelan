from __future__ import annotations

from dataclasses import dataclass
from statistics import mean

import pandas as pd


@dataclass(frozen=True)
class RiskComponents:
    hrv_component: float
    trend_component: float
    alert_component: float
    anomaly_component: float
    symptom_component: float
    medication_component: float

    def as_dict(self) -> dict[str, float]:
        return {
            "hrv_component": self.hrv_component,
            "trend_component": self.trend_component,
            "alert_component": self.alert_component,
            "anomaly_component": self.anomaly_component,
            "symptom_component": self.symptom_component,
            "medication_component": self.medication_component,
        }


def clamp01(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def compute_hrv_component(
    latest_measurement_df: pd.DataFrame,
    latest_baseline_df: pd.DataFrame,
) -> float:
    """Compare latest raw HRV values to persisted baseline averages/std values."""
    if latest_measurement_df.empty or latest_baseline_df.empty:
        return 0.0

    row = latest_measurement_df.iloc[0]
    base = latest_baseline_df.iloc[0]

    metrics = ["rmssd", "sdnn", "SD1", "SD2", "pNN50", "LF", "HF"]
    risks: list[float] = []

    for metric in metrics:
        current = float(row.get(metric, 0.0) or 0.0)
        avg = float(base.get(f"avg_{metric}", 0.0) or 0.0)
        std = float(base.get(f"std_{metric}", 0.0) or 0.0)

        if avg <= 0:
            continue

        # Lower HRV-related values than baseline are generally worse here.
        pct_drop = max(0.0, (avg - current) / avg)
        z = 0.0
        if std > 0:
            z = max(0.0, (avg - current) / std)

        metric_risk = clamp01(pct_drop * 0.6 + min(1.0, z / 3.0) * 0.4)
        risks.append(metric_risk)

    if not risks:
        return 0.0

    return float(mean(risks))


def compute_trend_component(latest_trends_df: pd.DataFrame) -> float:
    """Turn persisted trend rows into a risk component."""
    if latest_trends_df.empty:
        return 0.0

    risks: list[float] = []

    for _, row in latest_trends_df.iterrows():
        direction = str(row.get("trend_direction", "stable")).lower()
        strength = str(row.get("trend_strength", "weak")).lower()
        slope = float(row.get("slope", 0.0) or 0.0)
        r_value = abs(float(row.get("r_value", 0.0) or 0.0))

        direction_factor = 1.0 if direction == "declining" else 0.0
        strength_factor = {
            "weak": 0.25,
            "moderate": 0.60,
            "strong": 1.00,
        }.get(strength, 0.25)

        slope_factor = clamp01(abs(slope))
        corr_factor = clamp01(r_value)

        risk = clamp01(direction_factor * (strength_factor * 0.5 + corr_factor * 0.3 + slope_factor * 0.2))
        risks.append(risk)

    return float(mean(risks)) if risks else 0.0


def compute_alert_component(recent_alerts_df: pd.DataFrame, days_back: int) -> float:
    if recent_alerts_df.empty or days_back <= 0:
        return 0.0

    count_factor = clamp01(len(recent_alerts_df) / max(3, days_back // 2))

    severity_values: list[float] = []
    for _, row in recent_alerts_df.iterrows():
        deviation_pct = abs(float(row.get("deviation_pct", 0.0) or 0.0))
        severity_values.append(clamp01(deviation_pct / 50.0))

    severity_factor = float(mean(severity_values)) if severity_values else 0.0
    return clamp01(count_factor * 0.5 + severity_factor * 0.5)


def compute_anomaly_component(recent_anomalies_df: pd.DataFrame, days_back: int) -> float:
    if recent_anomalies_df.empty or days_back <= 0:
        return 0.0

    count_factor = clamp01(len(recent_anomalies_df) / max(3, days_back // 2))

    severity_values: list[float] = []
    for _, row in recent_anomalies_df.iterrows():
        z_score = abs(float(row.get("z_score", 0.0) or 0.0))
        severity_values.append(clamp01(z_score / 4.0))

    severity_factor = float(mean(severity_values)) if severity_values else 0.0
    return clamp01(count_factor * 0.4 + severity_factor * 0.6)


def split_recent_and_baseline(
    series: pd.Series,
    recent_days: int,
    baseline_days: int,
) -> tuple[pd.Series, pd.Series]:
    clean = series.dropna().reset_index(drop=True)
    recent = clean.iloc[:recent_days]
    baseline = clean.iloc[recent_days : recent_days + baseline_days]
    return recent, baseline


def compute_symptom_component(
    symptom_df_desc: pd.DataFrame,
    recent_days: int,
    baseline_days: int,
    min_recent_points: int,
    min_baseline_points: int,
    std_floor: float,
) -> float:
    if symptom_df_desc.empty:
        return 0.0

    symptom_specs: list[tuple[str, int]] = [
        ("fatigue_level", +1),
        ("cognitive_fog", +1),
        ("pain_level", +1),
        ("heat_sensitivity", +1),
        ("mobility_score", -1),
        ("mood_score", -1),
        ("overall_wellbeing", -1),
    ]

    scores: list[float] = []

    for column, direction in symptom_specs:
        if column not in symptom_df_desc.columns:
            continue

        recent, baseline = split_recent_and_baseline(symptom_df_desc[column], recent_days, baseline_days)
        if len(recent) < min_recent_points or len(baseline) < min_baseline_points:
            continue

        recent_avg = float(recent.mean())
        baseline_avg = float(baseline.mean())
        baseline_std = max(float(baseline.std(ddof=0)), std_floor)

        delta = (recent_avg - baseline_avg) * direction
        z = delta / baseline_std
        scores.append(clamp01(z / 1.5))

    return float(mean(scores)) if scores else 0.0


def compute_medication_component(
    medication_df: pd.DataFrame,
    adherence_threshold: float,
) -> float:
    if medication_df.empty:
        return 0.0

    total = len(medication_df)
    taken = int((medication_df["dose_taken"] == 1).sum())
    adherence = taken / total if total > 0 else 1.0

    if adherence >= adherence_threshold:
        return 0.0

    return clamp01((adherence_threshold - adherence) / adherence_threshold)


def combine_weighted_risks(
    components: RiskComponents,
    weights: dict[str, float],
) -> float:
    scores = components.as_dict()
    total = 0.0
    for key, value in scores.items():
        total += value * weights[key]
    return clamp01(total)


def classify_risk_level(score: float) -> str:
    if score <= 0.30:
        return "LOW"
    if score <= 0.60:
        return "MODERATE"
    if score <= 0.80:
        return "HIGH"
    return "CRITICAL"