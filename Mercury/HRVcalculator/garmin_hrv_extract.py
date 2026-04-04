#!/usr/bin/env python3
"""
garmin_hrv_extract_fitdecode.py

Extract HRV-relevant beat-to-beat intervals from a Garmin FIT file and compute:
- RMSSD
- SDNN
- pNN50
- mean RR
- mean HR

Also computes rolling-window HRV metrics and exports CSV files.

This version is designed for Garmin files where HRV data is stored as
developer fields on the RECORD message, e.g.:
- "hrv btb (ms)"
- "hrv hr (bpm)"
- "hrv rmssd30s (ms)"

Usage:
    python garmin_hrv_extract_fitdecode.py path/to/activity.fit

Optional:
    python garmin_hrv_extract_fitdecode.py path/to/activity.fit --window-seconds 60 --step-seconds 10

Dependencies:
    pip install fitdecode pandas numpy
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

def process_file(fit_path: Path, output_dir: Path, args) -> Optional[HRVMetrics]:
    rr_points = extract_rr_points(fit_path, debug_record_fields=args.debug_record_fields)

    if not rr_points:
        print(f"[SKIP] {fit_path.name} → No HRV data")
        return None

    rr_df = pd.DataFrame([asdict(p) for p in rr_points])

    overall = compute_metrics(rr_df["rr_ms"].tolist())
    if overall is None:
        print(f"[SKIP] {fit_path.name} → Not enough valid RR data")
        return None

    # Save per-file CSVs (optional)
    if output_dir:
        rolling_df = rolling_hrv(rr_points, args.window_seconds, args.step_seconds)

        rr_df.to_csv(output_dir / f"{fit_path.stem}_rr.csv", index=False)
        pd.DataFrame([asdict(overall)]).to_csv(output_dir / f"{fit_path.stem}_summary.csv", index=False)
        rolling_df.to_csv(output_dir / f"{fit_path.stem}_rolling.csv", index=False)

    return overall

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
    """
    Normalize RR value to seconds.

    For your file, 'hrv btb (ms)' is already in milliseconds, so assume_ms=True.
    """
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
    """
    Match likely Garmin developer-field names for beat-to-beat HRV.
    """
    name = normalize_field_name(field_name)

    candidates = {
        "hrv btb",
        "hrv btb (ms)",
        "hrv_btb",
        "btb",
    }

    if name in candidates:
        return True

    return "hrv" in name and "btb" in name


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
                print("\nRECORD fields:")
                for field in frame.fields:
                    print(f"  name={repr(field.name)} value={field.value}")

            for field in frame.fields:
                field_name = normalize_field_name(field.name)

                if field_name == "timestamp":
                    record_timestamp = fit_timestamp_to_datetime(field.value)
                    continue

                if is_hrv_btb_field(field_name):
                    rr_candidates_ms.extend(flatten_rr_value(field.value))

            # Each record row appears to store one HRV BTB value in ms.
            # If multiple values appear, they are treated as consecutive beats.
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


def summarize_sources(rr_points: List[RRPoint]) -> pd.DataFrame:
    if not rr_points:
        return pd.DataFrame(columns=["source", "count"])

    df = pd.DataFrame([asdict(p) for p in rr_points])
    return (
        df.groupby("source", as_index=False)
        .size()
        .rename(columns={"size": "count"})
        .sort_values("count", ascending=False)
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Batch HRV extraction from Garmin FIT files.")
    parser.add_argument("input_path", type=Path, help="FIT file OR folder containing FIT files")
    parser.add_argument("--window-seconds", type=int, default=60)
    parser.add_argument("--step-seconds", type=int, default=10)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--debug-record-fields", action="store_true")

    args = parser.parse_args()

    input_path = args.input_path

    # Resolve files
    if input_path.is_file():
        fit_files = [input_path]
    elif input_path.is_dir():
        fit_files = list(input_path.glob("*.fit"))
    else:
        raise ValueError("Input must be a FIT file or directory")

    if not fit_files:
        print("No FIT files found.")
        return

    output_dir = args.output_dir or input_path / "hrv_output"
    output_dir.mkdir(parents=True, exist_ok=True)

    results = []

    print("\n=== PROCESSING FILES ===\n")

    for fit_file in fit_files:
        print(f"Processing: {fit_file.name}")

        metrics = process_file(fit_file, output_dir, args)

        if metrics:
            results.append({
                "file": fit_file.name,
                "rmssd": round(metrics.rmssd_ms, 2),
                "sdnn": round(metrics.sdnn_ms, 2),
                "pnn50": round(metrics.pnn50_pct, 2),
                "mean_hr": round(metrics.mean_hr_bpm, 2),
                "intervals": metrics.n_intervals,
            })

    if not results:
        print("\nNo valid HRV data found in any files.")
        return

    summary_df = pd.DataFrame(results)

    print("\n=== HRV SUMMARY ===\n")
    print(summary_df.to_string(index=False))

    summary_path = output_dir / "batch_summary.csv"
    summary_df.to_csv(summary_path, index=False)

    print("\nSaved summary to:")
    print(summary_path)

if __name__ == "__main__":
    main()