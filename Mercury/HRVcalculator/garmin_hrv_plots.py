#!/usr/bin/env python3
"""
garmin_hrv_plots.py

Create charts from the CSV outputs of garmin_hrv_extract.py

Charts:
1. RR intervals over time
2. Rolling RMSSD over time
3. Rolling SDNN over time
4. Rolling mean HR over time
5. RMSSD vs mean HR
6. Recovery segments after high-intensity periods

Usage:
    python garmin_hrv_plots.py --rr-csv 22333218509_ACTIVITY_rr_intervals.csv \
                               --rolling-csv 22333218509_ACTIVITY_hrv_rolling.csv

Optional:
    python garmin_hrv_plots.py --rr-csv ... --rolling-csv ... \
                               --output-dir hrv_plots \
                               --recovery-threshold-hr 150 \
                               --recovery-min-drop 15 \
                               --recovery-window-seconds 120

Dependencies:
    pip install pandas numpy matplotlib
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Tuple

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


def ensure_datetime(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    out = df.copy()
    for col in cols:
        if col in out.columns:
            out[col] = pd.to_datetime(out[col], errors="coerce")
    return out


def save_plot(output_path: Path) -> None:
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()


def plot_rr_over_time(rr_df: pd.DataFrame, output_dir: Path) -> None:
    df = rr_df.dropna(subset=["beat_timestamp", "rr_ms"]).copy()
    if df.empty:
        return

    plt.figure(figsize=(12, 5))
    plt.plot(df["beat_timestamp"], df["rr_ms"])
    plt.xlabel("Time")
    plt.ylabel("RR interval (ms)")
    plt.title("RR Intervals Over Time")
    save_plot(output_dir / "01_rr_intervals_over_time.png")


def plot_rmssd_over_time(rolling_df: pd.DataFrame, output_dir: Path) -> None:
    df = rolling_df.dropna(subset=["window_start", "rmssd_ms"]).copy()
    if df.empty:
        return

    plt.figure(figsize=(12, 5))
    plt.plot(df["window_start"], df["rmssd_ms"])
    plt.xlabel("Time")
    plt.ylabel("RMSSD (ms)")
    plt.title("Rolling RMSSD Over Time")
    save_plot(output_dir / "02_rmssd_over_time.png")


def plot_sdnn_over_time(rolling_df: pd.DataFrame, output_dir: Path) -> None:
    df = rolling_df.dropna(subset=["window_start", "sdnn_ms"]).copy()
    if df.empty:
        return

    plt.figure(figsize=(12, 5))
    plt.plot(df["window_start"], df["sdnn_ms"])
    plt.xlabel("Time")
    plt.ylabel("SDNN (ms)")
    plt.title("Rolling SDNN Over Time")
    save_plot(output_dir / "03_sdnn_over_time.png")


def plot_mean_hr_over_time(rolling_df: pd.DataFrame, output_dir: Path) -> None:
    df = rolling_df.dropna(subset=["window_start", "mean_hr_bpm"]).copy()
    if df.empty:
        return

    plt.figure(figsize=(12, 5))
    plt.plot(df["window_start"], df["mean_hr_bpm"])
    plt.xlabel("Time")
    plt.ylabel("Mean HR (bpm)")
    plt.title("Rolling Mean Heart Rate Over Time")
    save_plot(output_dir / "04_mean_hr_over_time.png")


def plot_rmssd_vs_mean_hr(rolling_df: pd.DataFrame, output_dir: Path) -> None:
    df = rolling_df.dropna(subset=["rmssd_ms", "mean_hr_bpm"]).copy()
    if df.empty:
        return

    plt.figure(figsize=(7, 6))
    plt.scatter(df["mean_hr_bpm"], df["rmssd_ms"], alpha=0.7)
    plt.xlabel("Mean HR (bpm)")
    plt.ylabel("RMSSD (ms)")
    plt.title("RMSSD vs Mean Heart Rate")
    save_plot(output_dir / "05_rmssd_vs_mean_hr.png")


def detect_recovery_segments(
    rolling_df: pd.DataFrame,
    recovery_threshold_hr: float,
    recovery_min_drop: float,
    recovery_window_seconds: int,
) -> List[Tuple[pd.Timestamp, pd.Timestamp]]:
    """
    Simple heuristic:
    - Find windows where HR is above threshold
    - Then look ahead within recovery_window_seconds for HR drop >= recovery_min_drop
    """
    df = rolling_df.sort_values("window_start").dropna(
        subset=["window_start", "window_end", "mean_hr_bpm"]
    )
    if df.empty:
        return []

    segments: List[Tuple[pd.Timestamp, pd.Timestamp]] = []

    starts = df[df["mean_hr_bpm"] >= recovery_threshold_hr]
    for _, row in starts.iterrows():
        start_time = row["window_start"]
        start_hr = row["mean_hr_bpm"]
        end_limit = start_time + pd.Timedelta(seconds=recovery_window_seconds)

        future = df[
            (df["window_start"] > start_time)
            & (df["window_start"] <= end_limit)
            & ((start_hr - df["mean_hr_bpm"]) >= recovery_min_drop)
        ]

        if not future.empty:
            recovery_end = future.iloc[0]["window_start"]
            segments.append((start_time, recovery_end))

    # Deduplicate overlapping segments
    deduped: List[Tuple[pd.Timestamp, pd.Timestamp]] = []
    for seg in segments:
        if not deduped:
            deduped.append(seg)
            continue
        prev = deduped[-1]
        if seg[0] <= prev[1]:
            deduped[-1] = (prev[0], max(prev[1], seg[1]))
        else:
            deduped.append(seg)

    return deduped


def plot_recovery_segments(
    rolling_df: pd.DataFrame,
    output_dir: Path,
    recovery_threshold_hr: float,
    recovery_min_drop: float,
    recovery_window_seconds: int,
) -> pd.DataFrame:
    df = rolling_df.sort_values("window_start").dropna(
        subset=["window_start", "mean_hr_bpm", "rmssd_ms"]
    )
    if df.empty:
        return pd.DataFrame()

    segments = detect_recovery_segments(
        df,
        recovery_threshold_hr=recovery_threshold_hr,
        recovery_min_drop=recovery_min_drop,
        recovery_window_seconds=recovery_window_seconds,
    )

    if not segments:
        return pd.DataFrame()

    plt.figure(figsize=(12, 5))
    plt.plot(df["window_start"], df["mean_hr_bpm"], label="Mean HR")
    plt.xlabel("Time")
    plt.ylabel("Mean HR (bpm)")
    plt.title("Detected Recovery Segments")

    summary_rows = []
    for i, (seg_start, seg_end) in enumerate(segments, start=1):
        seg_df = df[(df["window_start"] >= seg_start) & (df["window_start"] <= seg_end)]
        if seg_df.empty:
            continue

        start_hr = float(seg_df.iloc[0]["mean_hr_bpm"])
        end_hr = float(seg_df.iloc[-1]["mean_hr_bpm"])
        start_rmssd = float(seg_df.iloc[0]["rmssd_ms"])
        end_rmssd = float(seg_df.iloc[-1]["rmssd_ms"])

        plt.axvspan(seg_start, seg_end, alpha=0.2)

        summary_rows.append(
            {
                "segment_id": i,
                "start_time": seg_start,
                "end_time": seg_end,
                "duration_seconds": (seg_end - seg_start).total_seconds(),
                "start_hr_bpm": start_hr,
                "end_hr_bpm": end_hr,
                "hr_drop_bpm": start_hr - end_hr,
                "start_rmssd_ms": start_rmssd,
                "end_rmssd_ms": end_rmssd,
                "rmssd_change_ms": end_rmssd - start_rmssd,
            }
        )

    save_plot(output_dir / "06_detected_recovery_segments.png")
    return pd.DataFrame(summary_rows)


def plot_recovery_rmssd(
    rolling_df: pd.DataFrame,
    output_dir: Path,
    recovery_segments_df: pd.DataFrame,
) -> None:
    if recovery_segments_df.empty:
        return

    df = rolling_df.sort_values("window_start").dropna(
        subset=["window_start", "rmssd_ms"]
    )
    if df.empty:
        return

    plt.figure(figsize=(12, 5))
    plt.plot(df["window_start"], df["rmssd_ms"])
    plt.xlabel("Time")
    plt.ylabel("RMSSD (ms)")
    plt.title("RMSSD with Recovery Segments Highlighted")

    for _, row in recovery_segments_df.iterrows():
        plt.axvspan(row["start_time"], row["end_time"], alpha=0.2)

    save_plot(output_dir / "07_rmssd_recovery_segments.png")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate HRV charts from Garmin HRV CSV outputs.")
    parser.add_argument("--rr-csv", type=Path, required=True, help="Path to *_rr_intervals.csv")
    parser.add_argument("--rolling-csv", type=Path, required=True, help="Path to *_hrv_rolling.csv")
    parser.add_argument("--output-dir", type=Path, default=Path("hrv_plots"), help="Directory for PNG output")
    parser.add_argument("--recovery-threshold-hr", type=float, default=150.0, help="HR threshold for recovery detection")
    parser.add_argument("--recovery-min-drop", type=float, default=15.0, help="Minimum HR drop to count as recovery")
    parser.add_argument("--recovery-window-seconds", type=int, default=120, help="Max time window to detect recovery")

    args = parser.parse_args()

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    rr_df = pd.read_csv(args.rr_csv)
    rolling_df = pd.read_csv(args.rolling_csv)

    rr_df = ensure_datetime(rr_df, ["anchor_timestamp", "beat_timestamp"])
    rolling_df = ensure_datetime(rolling_df, ["window_start", "window_end"])

    plot_rr_over_time(rr_df, output_dir)
    plot_rmssd_over_time(rolling_df, output_dir)
    plot_sdnn_over_time(rolling_df, output_dir)
    plot_mean_hr_over_time(rolling_df, output_dir)
    plot_rmssd_vs_mean_hr(rolling_df, output_dir)

    recovery_segments_df = plot_recovery_segments(
        rolling_df=rolling_df,
        output_dir=output_dir,
        recovery_threshold_hr=args.recovery_threshold_hr,
        recovery_min_drop=args.recovery_min_drop,
        recovery_window_seconds=args.recovery_window_seconds,
    )

    if not recovery_segments_df.empty:
        recovery_segments_df.to_csv(output_dir / "recovery_segments_summary.csv", index=False)
        plot_recovery_rmssd(rolling_df, output_dir, recovery_segments_df)

    print("\nCharts written to:")
    print(output_dir.resolve())

    written = sorted(output_dir.glob("*"))
    for p in written:
        print(p.name)


if __name__ == "__main__":
    main()