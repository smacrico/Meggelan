#!/usr/bin/env python3
"""
garmin_hrv_batch_analysis.py

Batch HRV analysis for a folder of Garmin FIT files.

Features:
1. Per-file HRV extraction
2. Weekly / monthly HRV trend summaries
3. Fatigue scoring model
4. Training load + HRV combined score

Dependencies:
    pip install fitdecode pandas numpy

Usage:
    python garmin_hrv_batch_analysis.py input_folder
    python garmin_hrv_batch_analysis.py input_folder --output-dir results
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, List, Optional

import fitdecode
import numpy as np
import pandas as pd


GARMIN_EPOCH = datetime(1989, 12, 31, tzinfo=timezone.utc)


@dataclass
class RRPoint:
    anchor_timestamp: Optional[datetime]
    beat_timestamp: Optional[datetime]
    rr_s: float
    rr_ms: float
    source: str


@dataclass
class HRVMetrics:
    n_intervals: int
    mean_rr_ms: float
    mean_hr_bpm: float
    rmssd_ms: float
    sdnn_ms: float
    pnn50_pct: float
    min_rr_ms: float
    max_rr_ms: float


def fit_timestamp_to_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return GARMIN_EPOCH + timedelta(seconds=float(value))
    return None


def safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def flatten_rr_value(value: Any) -> List[float]:
    out: List[float] = []
    if value is None:
        return out
    if isinstance(value, (list, tuple)):
        for item in value:
            out.extend(flatten_rr_value(item))
        return out
    fv = safe_float(value)
    if fv is not None:
        out.append(fv)
    return out


def normalize_rr_to_seconds(rr_value: float, assume_ms: bool = False) -> Optional[float]:
    if rr_value <= 0:
        return None

    rr_s = rr_value / 1000.0 if assume_ms else (rr_value / 1000.0 if rr_value > 5 else rr_value)

    if not (0.25 <= rr_s <= 3.0):
        return None

    return rr_s


def compute_metrics(rr_ms: Iterable[float]) -> Optional[HRVMetrics]:
    rr = np.array(list(rr_ms), dtype=float)

    if rr.size < 2:
        return None

    diffs = np.diff(rr)
    rmssd = float(np.sqrt(np.mean(diffs ** 2)))
    sdnn = float(np.std(rr, ddof=1)) if rr.size > 1 else 0.0
    nn50 = int(np.sum(np.abs(diffs) > 50.0))
    pnn50 = float(nn50 / diffs.size * 100.0) if diffs.size else 0.0
    mean_rr = float(np.mean(rr))
    mean_hr = float(60000.0 / mean_rr)

    return HRVMetrics(
        n_intervals=int(rr.size),
        mean_rr_ms=mean_rr,
        mean_hr_bpm=mean_hr,
        rmssd_ms=rmssd,
        sdnn_ms=sdnn,
        pnn50_pct=pnn50,
        min_rr_ms=float(np.min(rr)),
        max_rr_ms=float(np.max(rr)),
    )


def normalize_field_name(name: Any) -> str:
    if name is None:
        return ""
    return str(name).strip().lower()


def is_hrv_btb_field(field_name: str) -> bool:
    name = normalize_field_name(field_name)
    candidates = {"hrv btb", "hrv btb (ms)", "hrv_btb", "btb"}
    return name in candidates or ("hrv" in name and "btb" in name)


def extract_rr_points(fit_path: Path, debug_record_fields: bool = False) -> List[RRPoint]:
    rr_points: List[RRPoint] = []

    with fitdecode.FitReader(str(fit_path)) as fit:
        for frame in fit:
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue

            msg_name = normalize_field_name(frame.name)
            if msg_name != "record":
                continue

            record_timestamp: Optional[datetime] = None
            rr_candidates_ms: List[float] = []

            if debug_record_fields:
                print(f"\nRECORD fields in {fit_path.name}:")
                for field in frame.fields:
                    print(f"  name={repr(field.name)} value={field.value}")

            for field in frame.fields:
                field_name = normalize_field_name(field.name)

                if field_name == "timestamp":
                    record_timestamp = fit_timestamp_to_datetime(field.value)
                    continue

                if is_hrv_btb_field(field_name):
                    rr_candidates_ms.extend(flatten_rr_value(field.value))

            rolling_offset_s = 0.0

            for raw_rr in rr_candidates_ms:
                rr_s = normalize_rr_to_seconds(raw_rr, assume_ms=True)
                if rr_s is None:
                    continue

                beat_ts = (
                    record_timestamp + timedelta(seconds=rolling_offset_s)
                    if record_timestamp is not None
                    else None
                )

                rr_points.append(
                    RRPoint(
                        anchor_timestamp=record_timestamp,
                        beat_timestamp=beat_ts,
                        rr_s=rr_s,
                        rr_ms=rr_s * 1000.0,
                        source="record.hrv_btb",
                    )
                )
                rolling_offset_s += rr_s

    return rr_points


def rolling_hrv(
    rr_points: List[RRPoint],
    window_seconds: int,
    step_seconds: int,
) -> pd.DataFrame:
    rows: List[dict[str, Any]] = []

    beat_times = [p.beat_timestamp for p in rr_points if p.beat_timestamp is not None]
    if not beat_times:
        return pd.DataFrame()

    start_time = min(beat_times)
    end_time = max(beat_times)

    current = start_time
    while current + timedelta(seconds=window_seconds) <= end_time:
        window_end = current + timedelta(seconds=window_seconds)

        window_rr = [
            p.rr_ms
            for p in rr_points
            if p.beat_timestamp is not None and current <= p.beat_timestamp < window_end
        ]

        metrics = compute_metrics(window_rr)
        if metrics is not None:
            row = asdict(metrics)
            row["window_start"] = current.isoformat()
            row["window_end"] = window_end.isoformat()
            rows.append(row)

        current += timedelta(seconds=step_seconds)

    return pd.DataFrame(rows)


def process_file(fit_path: Path, output_dir: Path, window_seconds: int, step_seconds: int, debug: bool) -> Optional[dict]:
    rr_points = extract_rr_points(fit_path, debug_record_fields=debug)

    if not rr_points:
        print(f"[SKIP] {fit_path.name} -> No HRV data")
        return None

    rr_df = pd.DataFrame([asdict(p) for p in rr_points])
    overall = compute_metrics(rr_df["rr_ms"].tolist())

    if overall is None:
        print(f"[SKIP] {fit_path.name} -> Not enough valid RR data")
        return None

    rolling_df = rolling_hrv(rr_points, window_seconds, step_seconds)

    rr_csv = output_dir / f"{fit_path.stem}_rr.csv"
    rolling_csv = output_dir / f"{fit_path.stem}_rolling.csv"
    summary_csv = output_dir / f"{fit_path.stem}_summary.csv"

    rr_df.to_csv(rr_csv, index=False)
    rolling_df.to_csv(rolling_csv, index=False)
    pd.DataFrame([asdict(overall)]).to_csv(summary_csv, index=False)

    session_date = None
    if rr_points and rr_points[0].anchor_timestamp is not None:
        session_date = rr_points[0].anchor_timestamp

    # Simple internal training load proxy
    # Higher HR and more intervals -> larger load
    duration_minutes = overall.n_intervals * overall.mean_rr_ms / 1000.0 / 60.0
    training_load_proxy = duration_minutes * overall.mean_hr_bpm / 100.0

    return {
        "file": fit_path.name,
        "datetime": session_date,
        "date": session_date.date() if session_date else None,
        "rmssd": overall.rmssd_ms,
        "sdnn": overall.sdnn_ms,
        "pnn50": overall.pnn50_pct,
        "mean_hr": overall.mean_hr_bpm,
        "mean_rr": overall.mean_rr_ms,
        "intervals": overall.n_intervals,
        "duration_minutes": duration_minutes,
        "training_load_proxy": training_load_proxy,
    }


def add_trend_fields(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["datetime"] = pd.to_datetime(out["datetime"], errors="coerce")
    out["date"] = pd.to_datetime(out["date"], errors="coerce")
    out = out.sort_values("datetime")

    out["week"] = out["date"].dt.to_period("W").astype(str)
    out["month"] = out["date"].dt.to_period("M").astype(str)

    # Rolling baselines
    out["rmssd_7d_avg"] = out["rmssd"].rolling(window=7, min_periods=3).mean()
    out["rmssd_28d_avg"] = out["rmssd"].rolling(window=28, min_periods=5).mean()
    out["load_7d_sum"] = out["training_load_proxy"].rolling(window=7, min_periods=3).sum()
    out["load_28d_avg"] = out["training_load_proxy"].rolling(window=28, min_periods=5).mean()

    return out


def fatigue_score_model(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    # HRV suppression relative to recent baseline
    out["hrv_ratio_7d"] = out["rmssd"] / out["rmssd_7d_avg"]
    out["hrv_ratio_28d"] = out["rmssd"] / out["rmssd_28d_avg"]

    # Acute:chronic load ratio
    out["load_ratio"] = out["load_7d_sum"] / (out["load_28d_avg"] * 7.0)

    # Normalize safely
    out["hrv_penalty"] = np.where(out["hrv_ratio_7d"].notna(), np.clip((1.0 - out["hrv_ratio_7d"]) * 100.0, 0, 100), np.nan)
    out["load_penalty"] = np.where(out["load_ratio"].notna(), np.clip((out["load_ratio"] - 1.0) * 60.0, 0, 100), np.nan)
    out["hr_penalty"] = np.where(out["mean_hr"].notna(), np.clip((out["mean_hr"] - out["mean_hr"].rolling(7, min_periods=3).mean()) * 2.0, 0, 100), np.nan)

    # Combined fatigue score
    out["fatigue_score"] = (
        0.5 * out["hrv_penalty"].fillna(0)
        + 0.35 * out["load_penalty"].fillna(0)
        + 0.15 * out["hr_penalty"].fillna(0)
    )

    out["fatigue_score"] = np.clip(out["fatigue_score"], 0, 100)

    def label(score: float) -> str:
        if pd.isna(score):
            return "insufficient_data"
        if score < 20:
            return "fresh"
        if score < 40:
            return "normal"
        if score < 60:
            return "strained"
        if score < 80:
            return "fatigued"
        return "high_fatigue"

    out["fatigue_label"] = out["fatigue_score"].apply(label)

    return out


def combined_readiness_model(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    # HRV higher than baseline helps readiness
    out["hrv_support"] = np.where(
        out["rmssd_7d_avg"].notna(),
        np.clip((out["rmssd"] / out["rmssd_7d_avg"]) * 50.0, 0, 100),
        np.nan,
    )

    # Lower fatigue improves readiness
    out["fatigue_inverse"] = 100.0 - out["fatigue_score"]

    # Load balance helps readiness if near 1.0
    out["load_balance"] = np.where(
        out["load_ratio"].notna(),
        np.clip(100.0 - np.abs(out["load_ratio"] - 1.0) * 100.0, 0, 100),
        np.nan,
    )

    out["readiness_score"] = (
        0.45 * out["hrv_support"].fillna(0)
        + 0.35 * out["fatigue_inverse"].fillna(0)
        + 0.20 * out["load_balance"].fillna(0)
    )

    out["readiness_score"] = np.clip(out["readiness_score"], 0, 100)

    return out


def make_weekly_monthly_trends(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    weekly = (
        df.groupby("week", as_index=False)
        .agg(
            sessions=("file", "count"),
            avg_rmssd=("rmssd", "mean"),
            avg_sdnn=("sdnn", "mean"),
            avg_mean_hr=("mean_hr", "mean"),
            total_load=("training_load_proxy", "sum"),
            avg_fatigue=("fatigue_score", "mean"),
            avg_readiness=("readiness_score", "mean"),
        )
        .sort_values("week")
    )

    monthly = (
        df.groupby("month", as_index=False)
        .agg(
            sessions=("file", "count"),
            avg_rmssd=("rmssd", "mean"),
            avg_sdnn=("sdnn", "mean"),
            avg_mean_hr=("mean_hr", "mean"),
            total_load=("training_load_proxy", "sum"),
            avg_fatigue=("fatigue_score", "mean"),
            avg_readiness=("readiness_score", "mean"),
        )
        .sort_values("month")
    )

    return weekly, monthly


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch HRV extraction + trends + fatigue + training load")
    parser.add_argument("input_path", type=Path, help="Folder containing FIT files")
    parser.add_argument("--window-seconds", type=int, default=60)
    parser.add_argument("--step-seconds", type=int, default=10)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--debug-record-fields", action="store_true")
    args = parser.parse_args()

    input_path = args.input_path
    if not input_path.is_dir():
        raise ValueError("Input must be a folder containing FIT files.")

    fit_files = sorted(input_path.rglob("*.fit"))
    if not fit_files:
        print("No FIT files found.")
        return

    output_dir = args.output_dir or (input_path / "hrv_output")
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []

    print("\n=== PROCESSING FILES ===\n")
    for fit_file in fit_files:
        print(f"Processing: {fit_file.name}")
        row = process_file(
            fit_path=fit_file,
            output_dir=output_dir,
            window_seconds=args.window_seconds,
            step_seconds=args.step_seconds,
            debug=args.debug_record_fields,
        )
        if row:
            results.append(row)

    if not results:
        print("\nNo valid HRV data found in any files.")
        return

    summary_df = pd.DataFrame(results).sort_values("datetime")
    summary_df = add_trend_fields(summary_df)
    summary_df = fatigue_score_model(summary_df)
    summary_df = combined_readiness_model(summary_df)

    weekly_df, monthly_df = make_weekly_monthly_trends(summary_df)

    summary_path = output_dir / "batch_summary_with_fatigue_and_readiness.csv"
    weekly_path = output_dir / "weekly_hrv_trends.csv"
    monthly_path = output_dir / "monthly_hrv_trends.csv"

    summary_df.to_csv(summary_path, index=False)
    weekly_df.to_csv(weekly_path, index=False)
    monthly_df.to_csv(monthly_path, index=False)

    print("\n=== PER-FILE SUMMARY ===\n")
    print(
        summary_df[
            [
                "file",
                "date",
                "rmssd",
                "sdnn",
                "mean_hr",
                "training_load_proxy",
                "fatigue_score",
                "fatigue_label",
                "readiness_score",
            ]
        ].to_string(index=False)
    )

    print("\n=== WEEKLY HRV TRENDS ===\n")
    print(weekly_df.to_string(index=False))

    print("\n=== MONTHLY HRV TRENDS ===\n")
    print(monthly_df.to_string(index=False))

    print("\nSaved files:")
    print(summary_path)
    print(weekly_path)
    print(monthly_path)


if __name__ == "__main__":
    main()