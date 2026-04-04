#!/usr/bin/env python3
"""
garmin_hrv_extract.py

Extract HRV-relevant beat-to-beat intervals from a Garmin FIT file and compute:
- RMSSD
- SDNN
- pNN50
- mean RR
- mean HR

Also computes rolling-window HRV metrics and exports CSV files.

Usage:
    python garmin_hrv_extract.py path/to/activity.fit

Optional:
    python garmin_hrv_extract.py path/to/activity.fit --window-seconds 60 --step-seconds 10

Dependencies:
    pip install fitparse pandas numpy
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, List, Optional

import numpy as np
import pandas as pd
from fitparse import FitFile


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
    """
    Garmin FIT libraries may return RR values as:
    - scalar
    - list/tuple
    - nested collections
    """
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


def normalize_rr_to_seconds(rr_value: float) -> Optional[float]:
    """
    Heuristic normalization:
    - if value > 5, assume milliseconds
    - else assume seconds
    - reject implausible values
    """
    if rr_value <= 0:
        return None

    rr_s = rr_value / 1000.0 if rr_value > 5 else rr_value

    # Physiological plausibility filter
    # 0.25 s = 240 bpm
    # 3.0 s = 20 bpm
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


def extract_rr_points(fit_path: Path, debug_hrv_fields: bool = False) -> List[RRPoint]:
    fitfile = FitFile(str(fit_path))
    rr_points: List[RRPoint] = []

    last_anchor_ts: Optional[datetime] = None
    rolling_offset_s = 0.0

    for message in fitfile.get_messages():
        msg_name = message.name.lower()

        field_map = {field.name: field.value for field in message}

        # Update anchor timestamp from timestamped messages
        if msg_name in {"record", "event", "lap", "session"}:
            ts = fit_timestamp_to_datetime(field_map.get("timestamp"))
            if ts is not None:
                last_anchor_ts = ts
                rolling_offset_s = 0.0

        # Garmin HRV beat-to-beat data
        if msg_name == "hrv":
            rr_candidates: List[float] = []

            if debug_hrv_fields:
                print("\nHRV fields:")
                for field in message:
                    print(f"  name={repr(field.name)} value={field.value}")

            # Point only to the proper BTB column, with a safe fallback for naming variation
            for field in message:
                field_name = (field.name or "").lower()

                if field_name == "hrv_btb" or "btb" in field_name:
                    rr_candidates.extend(flatten_rr_value(field.value))

            for raw_rr in rr_candidates:
                rr_s = normalize_rr_to_seconds(raw_rr)
                if rr_s is None:
                    continue

                beat_ts = (
                    last_anchor_ts + timedelta(seconds=rolling_offset_s)
                    if last_anchor_ts is not None
                    else None
                )

                rr_points.append(
                    RRPoint(
                        anchor_timestamp=last_anchor_ts,
                        beat_timestamp=beat_ts,
                        rr_s=rr_s,
                        rr_ms=rr_s * 1000.0,
                        source="hrv_btb",
                    )
                )
                rolling_offset_s += rr_s

        # Legacy RR intervals from record messages
        if msg_name == "record":
            rr_value = field_map.get("rr_interval")
            if rr_value is not None:
                rr_candidates = flatten_rr_value(rr_value)

                for raw_rr in rr_candidates:
                    rr_s = normalize_rr_to_seconds(raw_rr)
                    if rr_s is None:
                        continue

                    beat_ts = (
                        last_anchor_ts + timedelta(seconds=rolling_offset_s)
                        if last_anchor_ts is not None
                        else None
                    )

                    rr_points.append(
                        RRPoint(
                            anchor_timestamp=last_anchor_ts,
                            beat_timestamp=beat_ts,
                            rr_s=rr_s,
                            rr_ms=rr_s * 1000.0,
                            source="record.rr_interval",
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
    parser = argparse.ArgumentParser(description="Extract and analyze HRV from Garmin FIT files.")
    parser.add_argument("fit_file", type=Path, help="Path to .fit file")
    parser.add_argument("--window-seconds", type=int, default=60, help="Rolling window size in seconds")
    parser.add_argument("--step-seconds", type=int, default=10, help="Rolling window step in seconds")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory for output CSV files (default: alongside FIT file)",
    )
    parser.add_argument(
        "--debug-hrv-fields",
        action="store_true",
        help="Print raw hrv message field names/values for debugging",
    )
    args = parser.parse_args()

    fit_path = args.fit_file
    if not fit_path.exists():
        raise FileNotFoundError(f"FIT file not found: {fit_path}")

    output_dir = args.output_dir or fit_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    rr_points = extract_rr_points(fit_path, debug_hrv_fields=args.debug_hrv_fields)

    if not rr_points:
        print("No RR / beat-to-beat intervals found.")
        print("This file likely contains heart rate only, not HRV-relevant data.")
        return

    rr_df = pd.DataFrame([asdict(p) for p in rr_points])
    rr_df["anchor_timestamp"] = rr_df["anchor_timestamp"].astype("string")
    rr_df["beat_timestamp"] = rr_df["beat_timestamp"].astype("string")

    overall = compute_metrics(rr_df["rr_ms"].tolist())
    if overall is None:
        print("RR intervals were found, but not enough valid data remained after filtering.")
        return

    rolling_df = rolling_hrv(rr_points, args.window_seconds, args.step_seconds)
    source_df = summarize_sources(rr_points)

    rr_csv = output_dir / f"{fit_path.stem}_rr_intervals.csv"
    overall_csv = output_dir / f"{fit_path.stem}_hrv_summary.csv"
    rolling_csv = output_dir / f"{fit_path.stem}_hrv_rolling.csv"
    source_csv = output_dir / f"{fit_path.stem}_rr_sources.csv"

    rr_df.to_csv(rr_csv, index=False)
    pd.DataFrame([asdict(overall)]).to_csv(overall_csv, index=False)
    rolling_df.to_csv(rolling_csv, index=False)
    source_df.to_csv(source_csv, index=False)

    print("\n=== OVERALL HRV SUMMARY ===")
    print(f"Intervals used : {overall.n_intervals}")
    print(f"Mean RR (ms)   : {overall.mean_rr_ms:.2f}")
    print(f"Mean HR (bpm)  : {overall.mean_hr_bpm:.2f}")
    print(f"RMSSD (ms)     : {overall.rmssd_ms:.2f}")
    print(f"SDNN (ms)      : {overall.sdnn_ms:.2f}")
    print(f"pNN50 (%)      : {overall.pnn50_pct:.2f}")
    print(f"Min RR (ms)    : {overall.min_rr_ms:.2f}")
    print(f"Max RR (ms)    : {overall.max_rr_ms:.2f}")

    print("\n=== RR SOURCES ===")
    if not source_df.empty:
        print(source_df.to_string(index=False))
    else:
        print("No source summary available.")

    print("\n=== FILES WRITTEN ===")
    print(rr_csv)
    print(overall_csv)
    print(rolling_csv)
    print(source_csv)


if __name__ == "__main__":
    main()