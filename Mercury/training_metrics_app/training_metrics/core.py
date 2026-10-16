
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd


CTL_DAYS = 42
ATL_DAYS = 7


@dataclass
class SourceDefinition:
    """Expected source data.

    Primary source:
      Intervals.icu activity export, either:
        - CSV exported from Intervals.icu activities, or
        - the workbook sheet named "intervals.icu_activities-export".

    Required columns:
      start_date_local, type, moving_time, distance, icu_training_load

    Recommended optional columns:
      icu_training_load_edited, name, average_heartrate, max_heartrate,
      average_speed, pace, total_elevation_gain, hr_load, pace_load,
      threshold_pace, lthr

    Optional comparison/forecast source:
      Existing workbook sheets "Daily Record" and "PMC forecast".
    """


def _read_sheet_or_csv(path: str | Path, sheet_name: Optional[str] = None, header: int = 0) -> pd.DataFrame:
    path = Path(path)
    if path.suffix.lower() in [".xlsx", ".xlsm", ".xls"]:
        return pd.read_excel(path, sheet_name=sheet_name or "intervals.icu_activities-export", header=header)
    return pd.read_csv(path)


def load_activities(path: str | Path, sheet_name: str = "intervals.icu_activities-export") -> pd.DataFrame:
    df = _read_sheet_or_csv(path, sheet_name=sheet_name)
    required = {"start_date_local", "type", "moving_time", "icu_training_load"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required activity columns: {sorted(missing)}")

    df = df.copy()
    df["start_date_local"] = pd.to_datetime(df["start_date_local"], errors="coerce")
    df = df.dropna(subset=["start_date_local"])
    df["date"] = df["start_date_local"].dt.floor("D")

    for col in [
        "moving_time", "distance", "average_heartrate", "max_heartrate",
        "average_speed", "pace", "icu_training_load", "icu_training_load_edited",
        "total_elevation_gain", "hr_load", "pace_load", "threshold_pace", "lthr"
    ]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "icu_training_load_edited" in df.columns:
        df["training_load"] = df["icu_training_load_edited"].fillna(df["icu_training_load"])
    else:
        df["training_load"] = df["icu_training_load"]

    df["training_load"] = df["training_load"].fillna(0)
    df["moving_minutes"] = df["moving_time"].fillna(0) / 60.0
    df["distance_km"] = df.get("distance", pd.Series(index=df.index, dtype=float)).fillna(0) / 1000.0

    # Intervals.icu average_speed is meters/second. Pace is minutes per km.
    speed = df.get("average_speed", pd.Series(index=df.index, dtype=float))
    df["pace_min_per_km"] = np.where(speed > 0, 1000.0 / speed / 60.0, np.nan)

    return df


def aggregate_daily(activities: pd.DataFrame) -> pd.DataFrame:
    def types_join(s: pd.Series) -> str:
        vals = [str(x) for x in s.dropna().unique()]
        return " + ".join(vals) if vals else "-"

    daily = activities.groupby("date").agg(
        activities=("date", "size"),
        activity_types=("type", types_join),
        moving_minutes=("moving_minutes", "sum"),
        daily_load=("training_load", "sum"),
        distance_km=("distance_km", "sum"),
        avg_hr=("average_heartrate", "mean") if "average_heartrate" in activities.columns else ("training_load", "size"),
        max_hr=("max_heartrate", "max") if "max_heartrate" in activities.columns else ("training_load", "size"),
    ).reset_index()

    full_idx = pd.date_range(daily["date"].min(), daily["date"].max(), freq="D")
    daily = daily.set_index("date").reindex(full_idx).rename_axis("date").reset_index()
    daily[["activities", "moving_minutes", "daily_load", "distance_km"]] = daily[["activities", "moving_minutes", "daily_load", "distance_km"]].fillna(0)
    daily["activity_types"] = daily["activity_types"].fillna("-")
    daily["intensity"] = np.where(
        daily["moving_minutes"] > 0,
        np.sqrt(daily["daily_load"] / (100.0 * (daily["moving_minutes"] / 60.0))),
        0,
    )
    return compute_pmc(daily)


def compute_pmc(daily: pd.DataFrame, ctl_days: int = CTL_DAYS, atl_days: int = ATL_DAYS) -> pd.DataFrame:
    daily = daily.sort_values("date").copy()
    ctl_decay = math.exp(-1 / ctl_days)
    atl_decay = math.exp(-1 / atl_days)
    ctl_gain = 1 - ctl_decay
    atl_gain = 1 - atl_decay

    ctl, atl = [], []
    prev_ctl = 0.0
    prev_atl = 0.0
    for load in daily["daily_load"].fillna(0).astype(float):
        next_ctl = load * ctl_gain + prev_ctl * ctl_decay
        next_atl = load * atl_gain + prev_atl * atl_decay
        ctl.append(next_ctl)
        atl.append(next_atl)
        prev_ctl, prev_atl = next_ctl, next_atl

    daily["fitness_ctl"] = ctl
    daily["fatigue_atl"] = atl
    daily["form_tsb"] = daily["fitness_ctl"] - daily["fatigue_atl"]
    daily["form_pct"] = np.where(daily["fitness_ctl"] > 0, daily["form_tsb"] / (daily["fitness_ctl"] * 0.3), np.nan)
    return daily


def load_pmc_forecast(path: str | Path, sheet_name: str = "PMC forecast") -> pd.DataFrame:
    df = _read_sheet_or_csv(path, sheet_name=sheet_name)
    df.columns = [str(c).strip() for c in df.columns]
    rename = {
        "DATE": "date",
        "Daily Load": "daily_load",
        "Fitness (CTL)": "fitness_ctl",
        "Fatigue (ATL)": "fatigue_atl",
        "Form": "form_tsb",
        "Moving Time": "moving_minutes",
        "Activities": "activities",
        "Intensity": "intensity",
    }
    df = df.rename(columns=rename)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df = df.dropna(subset=["date"])
    for col in ["daily_load", "fitness_ctl", "fatigue_atl", "form_tsb", "moving_minutes", "intensity"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def workout_type_breakdown(activities: pd.DataFrame) -> pd.DataFrame:
    return activities.groupby("type", dropna=False).agg(
        sessions=("type", "size"),
        total_load=("training_load", "sum"),
        moving_hours=("moving_minutes", lambda x: x.sum() / 60.0),
        distance_km=("distance_km", "sum"),
        avg_hr=("average_heartrate", "mean") if "average_heartrate" in activities.columns else ("training_load", "mean"),
    ).reset_index().sort_values("total_load", ascending=False)


def running_analysis(activities: pd.DataFrame) -> pd.DataFrame:
    runs = activities[activities["type"].astype(str).str.lower().eq("run")].copy()
    cols = ["start_date_local", "name", "distance_km", "moving_minutes", "pace_min_per_km", "average_heartrate", "max_heartrate", "training_load"]
    cols = [c for c in cols if c in runs.columns]
    runs = runs[cols].sort_values("start_date_local")
    if "distance_km" in runs:
        runs["km_per_hour"] = runs["distance_km"] / (runs["moving_minutes"] / 60.0)
    return runs


def race_readiness(pmc: pd.DataFrame) -> dict:
    df = pmc.dropna(subset=["date", "fitness_ctl", "fatigue_atl", "form_tsb"]).sort_values("date")
    if df.empty:
        return {"status": "No PMC data available."}

    current = df.iloc[-1]
    future = df[df["date"] >= current["date"]]
    ready = future[(future["form_tsb"] >= -5) & (future["form_tsb"] <= 10)]
    peak = future.sort_values(["fitness_ctl", "form_tsb"], ascending=[False, False]).head(1)

    status = "fatigued" if current["form_tsb"] < -10 else "fresh" if current["form_tsb"] > 10 else "balanced"
    return {
        "as_of": current["date"].date().isoformat(),
        "status": status,
        "fitness_ctl": round(float(current["fitness_ctl"]), 1),
        "fatigue_atl": round(float(current["fatigue_atl"]), 1),
        "form_tsb": round(float(current["form_tsb"]), 1),
        "first_ready_date": None if ready.empty else ready.iloc[0]["date"].date().isoformat(),
        "highest_ctl_date": None if peak.empty else peak.iloc[0]["date"].date().isoformat(),
        "highest_ctl": None if peak.empty else round(float(peak.iloc[0]["fitness_ctl"]), 1),
        "assessment": _readiness_text(current["form_tsb"]),
    }


def _readiness_text(form_tsb: float) -> str:
    if form_tsb < -20:
        return "High fatigue. Prioritize recovery before racing or key workouts."
    if form_tsb < -10:
        return "Productive but tired. Suitable for training, not ideal for racing."
    if form_tsb <= 5:
        return "Good readiness range for a key workout or race, assuming no soreness."
    if form_tsb <= 15:
        return "Fresh. Race-ready, but avoid excessive taper if fitness is falling."
    return "Very fresh. Watch for undertraining or loss of sharpness."
