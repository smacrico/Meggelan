
"""
MS Monitoring System v1
Rule-based longitudinal monitoring and relapse-risk scoring.

Inputs:
  data_templates/*.csv filled with personal data
Output:
  processed_daily_metrics.csv
  weekly_ms_report.md

Medical caution:
  This is a monitoring aid. It does not diagnose relapse, progression, or pseudo-relapse.
"""
from __future__ import annotations
import json
from pathlib import Path
import pandas as pd
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data_templates"
OUT = ROOT / "reports"

def load_csv(name: str) -> pd.DataFrame:
    path = DATA / name
    df = pd.read_csv(path)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    return df

def pct_dev(value, baseline, inverse=False):
    if pd.isna(value) or pd.isna(baseline) or baseline == 0:
        return np.nan
    dev = (value - baseline) / baseline * 100
    return -dev if inverse else dev

def score_component(dev, yellow, red):
    if pd.isna(dev):
        return 0
    x = max(0, dev)
    if x <= yellow:
        return (x / yellow) * 0.4
    if x <= red:
        return 0.4 + ((x - yellow) / (red - yellow)) * 0.4
    return min(1.0, 0.8 + (x - red) / red * 0.2)

def build_daily_metrics():
    with open(ROOT / "config.json") as f:
        cfg = json.load(f)

    hrv = load_csv("hrv_data.csv")
    sleep = load_csv("sleep_data.csv")
    activity = load_csv("activity_data.csv")
    symptoms = load_csv("symptoms_log.csv")

    # Merge all daily data
    dfs = [df for df in [hrv, sleep, activity, symptoms] if not df.empty]
    if not dfs:
        raise ValueError("No input data found. Fill CSV templates first.")

    daily = dfs[0]
    for df in dfs[1:]:
        daily = daily.merge(df, on="date", how="outer", suffixes=("","_dup"))
    daily = daily.sort_values("date").reset_index(drop=True)

    bdays = cfg["baseline_days"]
    daily["rmssd_baseline"] = daily["rmssd_ms"].rolling(bdays, min_periods=cfg["min_baseline_days"]).median().shift(1)
    daily["rhr_baseline"] = daily["resting_hr_bpm"].rolling(bdays, min_periods=cfg["min_baseline_days"]).median().shift(1)
    daily["sleep_baseline"] = daily["sleep_duration_h"].rolling(bdays, min_periods=cfg["min_baseline_days"]).median().shift(1)
    daily["steps_baseline"] = daily["steps"].rolling(bdays, min_periods=cfg["min_baseline_days"]).median().shift(1)
    daily["fatigue_baseline"] = daily["fatigue_0_10"].rolling(bdays, min_periods=cfg["min_baseline_days"]).median().shift(1)

    t = cfg["thresholds"]
    daily["hrv_drop_pct"] = daily.apply(lambda r: pct_dev(r.get("rmssd_ms"), r.get("rmssd_baseline"), inverse=True), axis=1)
    daily["rhr_rise_pct"] = daily.apply(lambda r: pct_dev(r.get("resting_hr_bpm"), r.get("rhr_baseline")), axis=1)
    daily["sleep_drop_pct"] = daily.apply(lambda r: pct_dev(r.get("sleep_duration_h"), r.get("sleep_baseline"), inverse=True), axis=1)
    daily["steps_drop_pct"] = daily.apply(lambda r: pct_dev(r.get("steps"), r.get("steps_baseline"), inverse=True), axis=1)
    daily["fatigue_rise"] = daily["fatigue_0_10"] - daily["fatigue_baseline"]

    symptom_cols = ["pain_0_10","spasticity_0_10","numbness_0_10","vision_0_10","balance_0_10","cognition_0_10","mood_0_10","bladder_0_10"]
    existing = [c for c in symptom_cols if c in daily.columns]
    daily["symptom_burden"] = daily[existing].mean(axis=1) if existing else 0

    w = cfg["risk_weights"]
    daily["risk_score"] = (
        score_series(daily["hrv_drop_pct"], t["hrv_drop_yellow_pct"], t["hrv_drop_red_pct"]) * w["hrv_suppression"] +
        score_series(daily["rhr_rise_pct"], t["rhr_rise_yellow_pct"], t["rhr_rise_red_pct"]) * w["rhr_elevation"] +
        score_series(daily["sleep_drop_pct"], t["sleep_drop_yellow_pct"], t["sleep_drop_red_pct"]) * w["sleep_deficit"] +
        score_series(daily["fatigue_rise"], t["fatigue_rise_yellow"], t["fatigue_rise_red"]) * w["fatigue_spike"] +
        score_series(daily["steps_drop_pct"], t["activity_drop_yellow_pct"], t["activity_drop_red_pct"]) * w["activity_drop"] +
        (daily["symptom_burden"].fillna(0) / 10).clip(0,1) * w["symptom_burden"]
    ).clip(0,100).round(1)

    # Reduce false alarms: flag pseudo-relapse confounders
    daily["confounder_flag"] = (
        daily.get("infection_flag", 0).fillna(0).astype(float).gt(0) |
        daily.get("temperature_flag", 0).fillna(0).astype(float).gt(0) |
        daily.get("heat_exposure_0_10", 0).fillna(0).astype(float).ge(6)
    )

    daily["risk_category"] = np.select(
        [daily["risk_score"] >= t["red"], daily["risk_score"] >= t["yellow"]],
        ["Red", "Yellow"],
        default="Green"
    )

    OUT.mkdir(exist_ok=True)
    daily.to_csv(OUT / "processed_daily_metrics.csv", index=False)
    return daily, cfg

def score_series(s, yellow, red):
    return s.apply(lambda x: score_component(x, yellow, red))

def weekly_report(daily: pd.DataFrame, cfg: dict, days: int = 7):
    recent = daily.dropna(subset=["date"]).tail(days)
    if recent.empty:
        raise ValueError("No recent data available.")

    avg_risk = recent["risk_score"].mean()
    max_risk = recent["risk_score"].max()
    status = "Stable"
    if max_risk >= cfg["thresholds"]["red"]:
        status = "High risk / monitor closely"
    elif max_risk >= cfg["thresholds"]["yellow"]:
        status = "Moderate risk / watch trend"

    top = recent[["hrv_drop_pct","rhr_rise_pct","sleep_drop_pct","fatigue_rise","steps_drop_pct","symptom_burden"]].mean(numeric_only=True).sort_values(ascending=False).head(3)

    text = f"""# Weekly MS Monitoring Report

## Overall status
**{status}**

- Average risk score: **{avg_risk:.1f}/100**
- Peak risk score: **{max_risk:.1f}/100**
- Confounder days: **{int(recent['confounder_flag'].sum())}/{len(recent)}**

## Main contributing signals
{top.to_frame('weekly_average').round(2).to_markdown()}

## Interpretation
This rule-based signal looks for sustained deviation from your own baseline, especially HRV suppression, resting heart-rate elevation, sleep deficit, fatigue increase, activity reduction, and symptom burden.

If symptoms are new or clearly worsening for more than 24 hours, especially without infection, fever, or heat exposure, discuss this with your MS clinician.

## Suggested actions
- Prioritize sleep and recovery for the next 3–5 days.
- Reduce heavy training load if HRV is suppressed and fatigue is elevated.
- Check for confounders: infection, fever, heat exposure, medication changes, unusually high stress.
- Contact your neurologist urgently for severe new neurological symptoms, vision loss, marked weakness, new walking difficulty, or bladder/bowel changes.
"""
    path = OUT / "weekly_ms_report.md"
    path.write_text(text, encoding="utf-8")
    return path

if __name__ == "__main__":
    daily, cfg = build_daily_metrics()
    path = weekly_report(daily, cfg)
    print(f"Created: {path}")
