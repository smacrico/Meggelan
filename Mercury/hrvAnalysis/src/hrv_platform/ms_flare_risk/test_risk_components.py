from __future__ import annotations

import pandas as pd

from ms_flare_risk.risk_components import (
    RiskComponents,
    classify_risk_level,
    combine_weighted_risks,
    compute_alert_component,
    compute_anomaly_component,
    compute_hrv_component,
    compute_medication_component,
    compute_symptom_component,
    compute_trend_component,
)


def test_hrv_component_higher_when_latest_below_baseline() -> None:
    latest = pd.DataFrame(
        [
            {
                "rmssd": 20,
                "sdnn": 25,
                "SD1": 10,
                "SD2": 20,
                "pNN50": 5,
                "LF": 200,
                "HF": 180,
            }
        ]
    )
    baseline = pd.DataFrame(
        [
            {
                "avg_rmssd": 40, "std_rmssd": 5,
                "avg_sdnn": 50, "std_sdnn": 5,
                "avg_SD1": 20, "std_SD1": 3,
                "avg_SD2": 40, "std_SD2": 4,
                "avg_pNN50": 10, "std_pNN50": 2,
                "avg_LF": 400, "std_LF": 40,
                "avg_HF": 350, "std_HF": 35,
            }
        ]
    )
    risk = compute_hrv_component(latest, baseline)
    assert risk > 0.4


def test_trend_component_detects_declining_trends() -> None:
    trends = pd.DataFrame(
        [
            {"metric": "rmssd", "trend_direction": "declining", "trend_strength": "strong", "slope": -0.2, "r_value": 0.8},
            {"metric": "sdnn", "trend_direction": "declining", "trend_strength": "moderate", "slope": -0.1, "r_value": 0.5},
        ]
    )
    risk = compute_trend_component(trends)
    assert risk > 0.3


def test_alert_component_uses_count_and_severity() -> None:
    alerts = pd.DataFrame(
        [
            {"deviation_pct": -30},
            {"deviation_pct": -40},
            {"deviation_pct": -25},
        ]
    )
    risk = compute_alert_component(alerts, days_back=14)
    assert risk > 0.3


def test_anomaly_component_uses_count_and_zscore() -> None:
    anomalies = pd.DataFrame(
        [
            {"z_score": 2.8},
            {"z_score": 3.5},
            {"z_score": 2.6},
        ]
    )
    risk = compute_anomaly_component(anomalies, days_back=14)
    assert risk > 0.3


def test_symptom_component_detects_recent_worsening() -> None:
    df = pd.DataFrame(
        {
            "fatigue_level": [8, 8, 7, 8, 7, 3, 2, 3, 2, 3, 2, 3],
            "cognitive_fog": [7, 7, 8, 7, 8, 2, 2, 3, 2, 2, 3, 2],
            "mobility_score": [3, 3, 4, 3, 4, 8, 8, 7, 8, 7, 8, 8],
            "pain_level": [6, 6, 7, 6, 7, 2, 2, 3, 2, 2, 3, 2],
            "mood_score": [3, 4, 3, 3, 4, 8, 8, 7, 8, 7, 8, 8],
            "heat_sensitivity": [7, 8, 7, 8, 7, 2, 2, 3, 2, 2, 3, 2],
            "overall_wellbeing": [3, 3, 4, 3, 4, 8, 8, 7, 8, 7, 8, 8],
        }
    )
    risk = compute_symptom_component(
        symptom_df_desc=df,
        recent_days=5,
        baseline_days=7,
        min_recent_points=4,
        min_baseline_points=5,
        std_floor=1.0,
    )
    assert risk > 0.3


def test_medication_component_zero_when_good_adherence() -> None:
    meds = pd.DataFrame({"dose_taken": [1] * 29 + [0]})
    risk = compute_medication_component(meds, adherence_threshold=0.85)
    assert risk == 0.0


def test_combine_and_classify() -> None:
    components = RiskComponents(
        hrv_component=0.5,
        trend_component=0.5,
        alert_component=0.5,
        anomaly_component=0.5,
        symptom_component=0.5,
        medication_component=0.5,
    )
    weights = {
        "hrv_component": 0.28,
        "trend_component": 0.20,
        "alert_component": 0.14,
        "anomaly_component": 0.14,
        "symptom_component": 0.16,
        "medication_component": 0.08,
    }
    score = combine_weighted_risks(components, weights)
    assert 0.49 <= score <= 0.51
    assert classify_risk_level(score) == "MODERATE"