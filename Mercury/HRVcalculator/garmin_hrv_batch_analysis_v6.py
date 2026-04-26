#!/usr/bin/env python3
"""
garmin_hrv_batch_analysis_v6.py

Batch HRV extraction + charts + fatigue + TRIMP + athlete config + SQLite summaries
with stronger operational robustness.

Features
1. Extract RR intervals from Garmin FIT record developer fields:
   - "hrv btb (ms)"
   - "hrv beat2beat int(ms)"
   - close naming variants
2. Compute per-file HRV metrics
3. Compute TRIMP using athlete config (resting_hr, max_hr, sex)
4. Daily / weekly / monthly HRV trends
5. Fatigue / readiness model
6. Automatic matplotlib charts
7. Store daily / weekly / monthly summaries in SQLite (hydra.db)
8. Store session_summary in SQLite
9. Store processing_log in SQLite
10. File-based logging with timestamps
11. Failed-files CSV report
12. Chart metadata persistence
13. Report manifest table + CSV

Dependencies:
    pip install fitdecode pandas numpy matplotlib

Usage:
    python garmin_hrv_batch_analysis_v6.py input_folder --config athlete_config.json
    python garmin_hrv_batch_analysis_v6.py input_folder --config athlete_config.json --athlete stelios
"""

from __future__ import annotations

import argparse
import json
import logging
import sqlite3
import traceback
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, List, Optional

import fitdecode
import matplotlib.pyplot as plt
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


@dataclass
class AthleteConfig:
    resting_hr: Optional[float] = None
    max_hr: Optional[float] = None
    sex: str = "male"


@dataclass
class SessionSummary:
    file: str
    datetime: Optional[datetime]
    date: Optional[datetime]
    rmssd: float
    sdnn: float
    pnn50: float
    mean_hr: float
    mean_rr: float
    intervals: int
    duration_minutes: float
    trimp: float
    max_hr: float
    resting_hr: float
    sex: str


def setup_logging(output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = output_dir / "hrv_pipeline.log"

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(logging.INFO)
    stream_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)

    logging.info("Logging initialized.")
    return log_path


def load_config(config_path: Optional[Path], athlete_name: Optional[str]) -> AthleteConfig:
    if config_path is None:
        return AthleteConfig()

    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    default_cfg = raw.get("default", {})
    athlete_cfg = raw.get("athletes", {}).get(athlete_name, {}) if athlete_name else {}
    merged = {**default_cfg, **athlete_cfg}

    return AthleteConfig(
        resting_hr=merged.get("resting_hr"),
        max_hr=merged.get("max_hr"),
        sex=str(merged.get("sex", "male")).lower(),
    )


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
    rmssd = float(np.sqrt(np.mean(diffs**2)))
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


def compact_field_name(name: str) -> str:
    return "".join(ch for ch in normalize_field_name(name) if ch.isalnum())


def is_hrv_btb_field(field_name: str) -> bool:
    raw = normalize_field_name(field_name)
    compact = compact_field_name(field_name)

    exact_candidates = {
        "hrv btb",
        "hrv btb (ms)",
        "hrv_btb",
        "btb",
        "hrv beat2beat int(ms)",
        "hrv beat2beat interval(ms)",
        "hrv beat2beat interval (ms)",
    }
    if raw in exact_candidates:
        return True

    compact_candidates = {
        "hrvbtb",
        "btb",
        "hrvbeat2beatintms",
        "hrvbeat2beatintervalms",
    }
    if compact in compact_candidates:
        return True

    if "hrv" in raw and "btb" in raw:
        return True
    if "hrv" in raw and "beat2beat" in raw:
        return True
    if "hrv" in raw and "beat to beat" in raw:
        return True

    return False


def extract_rr_points_and_hr(
    fit_path: Path,
    debug_record_fields: bool = False,
) -> tuple[List[RRPoint], List[dict]]:
    rr_points: List[RRPoint] = []
    hr_rows: List[dict] = []

    with fitdecode.FitReader(str(fit_path)) as fit:
        for frame in fit:
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue

            msg_name = normalize_field_name(frame.name)
            if msg_name != "record":
                continue

            record_timestamp: Optional[datetime] = None
            rr_candidates_ms: List[float] = []
            heart_rate: Optional[float] = None

            if debug_record_fields:
                print(f"\nRECORD fields in {fit_path.name}:")
                for field in frame.fields:
                    print(f"  name={repr(field.name)} value={field.value}")

            for field in frame.fields:
                field_name = normalize_field_name(field.name)

                if field_name == "timestamp":
                    record_timestamp = fit_timestamp_to_datetime(field.value)
                    continue

                if field_name in {"heart_rate", "heart rate"}:
                    heart_rate = safe_float(field.value)
                    continue

                if is_hrv_btb_field(field_name):
                    rr_candidates_ms.extend(flatten_rr_value(field.value))

            if record_timestamp is not None and heart_rate is not None:
                hr_rows.append({"timestamp": record_timestamp, "heart_rate": heart_rate})

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

    return rr_points, hr_rows


def rolling_hrv(rr_points: List[RRPoint], window_seconds: int, step_seconds: int) -> pd.DataFrame:
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
            row["window_start"] = current
            row["window_end"] = window_end
            rows.append(row)

        current += timedelta(seconds=step_seconds)

    return pd.DataFrame(rows)


def estimate_resting_hr(hr_df: pd.DataFrame, cfg_resting_hr: Optional[float]) -> float:
    if cfg_resting_hr is not None:
        return float(cfg_resting_hr)
    if hr_df.empty:
        return np.nan
    return float(hr_df["heart_rate"].quantile(0.10))


def estimate_max_hr(hr_df: pd.DataFrame, cfg_max_hr: Optional[float]) -> float:
    if cfg_max_hr is not None:
        return float(cfg_max_hr)
    if hr_df.empty:
        return 190.0
    return float(max(hr_df["heart_rate"].max(), 190.0))


def compute_trimp(hr_df: pd.DataFrame, resting_hr: float, max_hr: float, sex: str) -> float:
    """
    Banister-style TRIMP, sex-adjusted coefficients often used in practice:
    male:   y = 0.64 * exp(1.92 * HRr)
    female: y = 0.86 * exp(1.67 * HRr)
    """
    if hr_df.empty or np.isnan(resting_hr) or np.isnan(max_hr) or max_hr <= resting_hr:
        return np.nan

    hr = hr_df["heart_rate"].astype(float).clip(lower=resting_hr, upper=max_hr)
    hrr = (hr - resting_hr) / (max_hr - resting_hr)

    if str(sex).lower() == "female":
        per_minute_factor = hrr * 0.86 * np.exp(1.67 * hrr)
    else:
        per_minute_factor = hrr * 0.64 * np.exp(1.92 * hrr)

    if "timestamp" in hr_df.columns and len(hr_df) > 1:
        ts = pd.to_datetime(hr_df["timestamp"])
        delta_s = ts.diff().dt.total_seconds().fillna(1).clip(lower=1, upper=10)
    else:
        delta_s = pd.Series(np.ones(len(hr_df)))

    trimp = float(np.sum((delta_s / 60.0) * per_minute_factor))
    return trimp


def process_file(
    fit_path: Path,
    output_dir: Path,
    window_seconds: int,
    step_seconds: int,
    debug: bool,
    athlete_cfg: AthleteConfig,
) -> Optional[dict]:
    rr_points, hr_rows = extract_rr_points_and_hr(fit_path, debug_record_fields=debug)

    if not rr_points:
        return None

    rr_df = pd.DataFrame([asdict(p) for p in rr_points])
    hr_df = pd.DataFrame(hr_rows)

    overall = compute_metrics(rr_df["rr_ms"].tolist())
    if overall is None:
        return None

    rolling_df = rolling_hrv(rr_points, window_seconds, step_seconds)

    rr_df.to_csv(output_dir / f"{fit_path.stem}_rr.csv", index=False)
    rolling_df.to_csv(output_dir / f"{fit_path.stem}_rolling.csv", index=False)

    session_date = rr_points[0].anchor_timestamp if rr_points and rr_points[0].anchor_timestamp is not None else None
    duration_minutes = overall.n_intervals * overall.mean_rr_ms / 1000.0 / 60.0

    resting_hr = estimate_resting_hr(hr_df, athlete_cfg.resting_hr)
    max_hr = estimate_max_hr(hr_df, athlete_cfg.max_hr)
    trimp = compute_trimp(hr_df, resting_hr, max_hr, athlete_cfg.sex)

    row = SessionSummary(
        file=fit_path.name,
        datetime=session_date,
        date=session_date.date() if session_date else None,
        rmssd=overall.rmssd_ms,
        sdnn=overall.sdnn_ms,
        pnn50=overall.pnn50_pct,
        mean_hr=overall.mean_hr_bpm,
        mean_rr=overall.mean_rr_ms,
        intervals=overall.n_intervals,
        duration_minutes=duration_minutes,
        trimp=trimp,
        max_hr=max_hr,
        resting_hr=resting_hr,
        sex=athlete_cfg.sex,
    )

    pd.DataFrame([asdict(row)]).to_csv(output_dir / f"{fit_path.stem}_summary.csv", index=False)
    return asdict(row)


def add_trend_fields(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["datetime"] = pd.to_datetime(out["datetime"], errors="coerce")
    out["date"] = pd.to_datetime(out["date"], errors="coerce")
    out = out.sort_values("datetime")

    out["week"] = out["date"].dt.to_period("W").astype(str)
    out["month"] = out["date"].dt.to_period("M").astype(str)

    out["rmssd_7d_avg"] = out["rmssd"].rolling(window=7, min_periods=3).mean()
    out["rmssd_28d_avg"] = out["rmssd"].rolling(window=28, min_periods=5).mean()

    out["trimp_7d_sum"] = out["trimp"].rolling(window=7, min_periods=3).sum()
    out["trimp_28d_sum"] = out["trimp"].rolling(window=28, min_periods=5).sum()
    out["acr_trimp"] = out["trimp_7d_sum"] / (out["trimp_28d_sum"] / 4.0)

    return out


def fatigue_score_model(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    out["hrv_ratio"] = out["rmssd"] / out["rmssd_7d_avg"]

    out["hrv_penalty"] = np.where(
        out["hrv_ratio"].notna(),
        np.clip((1.0 - out["hrv_ratio"]) * 120.0, 0, 100),
        np.nan,
    )

    out["load_penalty"] = np.where(
        out["acr_trimp"].notna(),
        np.clip((out["acr_trimp"] - 1.0) * 70.0, 0, 100),
        np.nan,
    )

    rolling_hr_baseline = out["mean_hr"].rolling(window=7, min_periods=3).mean()
    out["hr_penalty"] = np.where(
        rolling_hr_baseline.notna(),
        np.clip((out["mean_hr"] - rolling_hr_baseline) * 2.5, 0, 100),
        np.nan,
    )

    out["fatigue_score"] = (
        0.55 * out["hrv_penalty"].fillna(0)
        + 0.35 * out["load_penalty"].fillna(0)
        + 0.10 * out["hr_penalty"].fillna(0)
    )
    out["fatigue_score"] = np.clip(out["fatigue_score"], 0, 100)

    def fatigue_label(score: float) -> str:
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

    out["fatigue_label"] = out["fatigue_score"].apply(fatigue_label)
    return out


def combined_readiness_model(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    out["hrv_support"] = np.where(
        out["rmssd_7d_avg"].notna(),
        np.clip((out["rmssd"] / out["rmssd_7d_avg"]) * 50.0, 0, 100),
        np.nan,
    )

    out["fatigue_inverse"] = 100.0 - out["fatigue_score"]

    out["load_balance"] = np.where(
        out["acr_trimp"].notna(),
        np.clip(100.0 - np.abs(out["acr_trimp"] - 1.0) * 120.0, 0, 100),
        np.nan,
    )

    out["readiness_score"] = (
        0.45 * out["hrv_support"].fillna(0)
        + 0.35 * out["fatigue_inverse"].fillna(0)
        + 0.20 * out["load_balance"].fillna(0)
    )
    out["readiness_score"] = np.clip(out["readiness_score"], 0, 100)

    return out


def make_daily_trends(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["date"] = pd.to_datetime(out["date"], errors="coerce")

    out = out[out["date"].notna()].copy()
    if out.empty:
        return pd.DataFrame(
            columns=[
                "summary_date",
                "sessions",
                "avg_rmssd",
                "avg_sdnn",
                "avg_mean_hr",
                "total_trimp",
                "avg_fatigue",
                "avg_readiness",
            ]
        )

    out["summary_date"] = out["date"].dt.strftime("%Y-%m-%d")

    daily = (
        out.groupby("summary_date", as_index=False)
        .agg(
            sessions=("file", "count"),
            avg_rmssd=("rmssd", "mean"),
            avg_sdnn=("sdnn", "mean"),
            avg_mean_hr=("mean_hr", "mean"),
            total_trimp=("trimp", "sum"),
            avg_fatigue=("fatigue_score", "mean"),
            avg_readiness=("readiness_score", "mean"),
        )
        .sort_values("summary_date")
        .reset_index(drop=True)
    )
    return daily


def make_weekly_monthly_trends(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    weekly = (
        df.groupby("week", as_index=False)
        .agg(
            sessions=("file", "count"),
            avg_rmssd=("rmssd", "mean"),
            avg_sdnn=("sdnn", "mean"),
            avg_mean_hr=("mean_hr", "mean"),
            total_trimp=("trimp", "sum"),
            avg_fatigue=("fatigue_score", "mean"),
            avg_readiness=("readiness_score", "mean"),
        )
        .sort_values("week")
        .reset_index(drop=True)
    )

    monthly = (
        df.groupby("month", as_index=False)
        .agg(
            sessions=("file", "count"),
            avg_rmssd=("rmssd", "mean"),
            avg_sdnn=("sdnn", "mean"),
            avg_mean_hr=("mean_hr", "mean"),
            total_trimp=("trimp", "sum"),
            avg_fatigue=("fatigue_score", "mean"),
            avg_readiness=("readiness_score", "mean"),
        )
        .sort_values("month")
        .reset_index(drop=True)
    )

    return weekly, monthly


def connect_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def create_summary_tables(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS session_summary (
            file TEXT PRIMARY KEY,
            session_datetime TEXT,
            session_date TEXT,
            rmssd REAL,
            sdnn REAL,
            pnn50 REAL,
            mean_hr REAL,
            mean_rr REAL,
            intervals INTEGER,
            duration_minutes REAL,
            trimp REAL,
            max_hr REAL,
            resting_hr REAL,
            sex TEXT,
            run_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS daily_summary (
            summary_date TEXT PRIMARY KEY,
            sessions INTEGER,
            avg_rmssd REAL,
            avg_sdnn REAL,
            avg_mean_hr REAL,
            total_trimp REAL,
            avg_fatigue REAL,
            avg_readiness REAL,
            run_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS weekly_summary (
            week TEXT PRIMARY KEY,
            sessions INTEGER,
            avg_rmssd REAL,
            avg_sdnn REAL,
            avg_mean_hr REAL,
            total_trimp REAL,
            avg_fatigue REAL,
            avg_readiness REAL,
            run_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS monthly_summary (
            month TEXT PRIMARY KEY,
            sessions INTEGER,
            avg_rmssd REAL,
            avg_sdnn REAL,
            avg_mean_hr REAL,
            total_trimp REAL,
            avg_fatigue REAL,
            avg_readiness REAL,
            run_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS processing_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT,
            event_time TEXT DEFAULT CURRENT_TIMESTAMP,
            level TEXT,
            file TEXT,
            event_type TEXT,
            message TEXT,
            details TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS chart_metadata (
            chart_path TEXT PRIMARY KEY,
            chart_name TEXT,
            chart_type TEXT,
            x_field TEXT,
            y_field TEXT,
            row_count INTEGER,
            run_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS report_manifest (
            artifact_path TEXT PRIMARY KEY,
            artifact_type TEXT,
            description TEXT,
            run_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()


def write_processing_log(
    conn: sqlite3.Connection,
    run_id: str,
    level: str,
    file: Optional[str],
    event_type: str,
    message: str,
    details: Optional[str] = None,
) -> None:
    conn.execute(
        """
        INSERT INTO processing_log (run_id, level, file, event_type, message, details)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (run_id, level, file, event_type, message, details),
    )
    conn.commit()


def upsert_dataframe(
    conn: sqlite3.Connection,
    df: pd.DataFrame,
    table_name: str,
    key_column: str,
) -> None:
    if df.empty:
        return

    columns = list(df.columns)
    placeholders = ", ".join(["?"] * len(columns))
    col_list = ", ".join(columns)
    update_cols = [c for c in columns if c != key_column]
    update_clause = ", ".join([f"{c}=excluded.{c}" for c in update_cols])

    sql = f"""
        INSERT INTO {table_name} ({col_list})
        VALUES ({placeholders})
        ON CONFLICT({key_column}) DO UPDATE SET
        {update_clause}
    """

    rows = []
    for _, row in df.iterrows():
        values = []
        for col in columns:
            value = row[col]
            if pd.isna(value):
                value = None
            values.append(value)
        rows.append(tuple(values))

    conn.executemany(sql, rows)
    conn.commit()


def save_session_summaries_to_db(
    conn: sqlite3.Connection,
    summary_df: pd.DataFrame,
    run_id: str,
) -> None:
    if summary_df.empty:
        return

    session_df = summary_df.copy()
    session_df["session_datetime"] = pd.to_datetime(session_df["datetime"], errors="coerce").astype("string")
    session_df["session_date"] = pd.to_datetime(session_df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    session_df["run_id"] = run_id

    session_df = session_df[
        [
            "file",
            "session_datetime",
            "session_date",
            "rmssd",
            "sdnn",
            "pnn50",
            "mean_hr",
            "mean_rr",
            "intervals",
            "duration_minutes",
            "trimp",
            "max_hr",
            "resting_hr",
            "sex",
            "run_id",
        ]
    ].copy()

    upsert_dataframe(conn, session_df, "session_summary", "file")


def attach_run_id(df: pd.DataFrame, run_id: str) -> pd.DataFrame:
    out = df.copy()
    out["run_id"] = run_id
    return out


def save_summaries_to_hydra_db(
    db_path: Path,
    summary_df: pd.DataFrame,
    daily_df: pd.DataFrame,
    weekly_df: pd.DataFrame,
    monthly_df: pd.DataFrame,
    run_id: str,
) -> None:
    conn = connect_db(db_path)
    try:
        create_summary_tables(conn)
        save_session_summaries_to_db(conn, summary_df, run_id)
        upsert_dataframe(conn, attach_run_id(daily_df, run_id), "daily_summary", "summary_date")
        upsert_dataframe(conn, attach_run_id(weekly_df, run_id), "weekly_summary", "week")
        upsert_dataframe(conn, attach_run_id(monthly_df, run_id), "monthly_summary", "month")
    finally:
        conn.close()


def save_chart_metadata_to_db(db_path: Path, chart_rows: List[dict]) -> None:
    if not chart_rows:
        return

    conn = connect_db(db_path)
    try:
        create_summary_tables(conn)
        chart_df = pd.DataFrame(chart_rows)
        upsert_dataframe(conn, chart_df, "chart_metadata", "chart_path")
    finally:
        conn.close()


def save_report_manifest_to_db(db_path: Path, manifest_df: pd.DataFrame) -> None:
    if manifest_df.empty:
        return

    conn = connect_db(db_path)
    try:
        create_summary_tables(conn)
        upsert_dataframe(conn, manifest_df, "report_manifest", "artifact_path")
    finally:
        conn.close()


def save_failed_files_report(failed_files: List[dict], output_dir: Path) -> Path:
    failed_path = output_dir / "failed_files.csv"
    if not failed_files:
        pd.DataFrame(columns=["file", "error_type", "error_message"]).to_csv(failed_path, index=False)
        return failed_path

    pd.DataFrame(failed_files).to_csv(failed_path, index=False)
    return failed_path


def save_plot(output_path: Path) -> None:
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()


def generate_charts(
    summary_df: pd.DataFrame,
    weekly_df: pd.DataFrame,
    monthly_df: pd.DataFrame,
    output_dir: Path,
    run_id: str,
) -> List[dict]:
    charts_dir = output_dir / "charts"
    charts_dir.mkdir(parents=True, exist_ok=True)

    sdf = summary_df.sort_values("datetime").copy()
    chart_rows: List[dict] = []

    def register_chart(path: Path, name: str, chart_type: str, x_field: str, y_field: str, row_count: int) -> None:
        chart_rows.append(
            {
                "chart_path": str(path),
                "chart_name": name,
                "chart_type": chart_type,
                "x_field": x_field,
                "y_field": y_field,
                "row_count": row_count,
                "run_id": run_id,
            }
        )

    p = charts_dir / "01_rmssd_over_time.png"
    plt.figure(figsize=(12, 5))
    plt.plot(sdf["datetime"], sdf["rmssd"])
    plt.xlabel("Date")
    plt.ylabel("RMSSD (ms)")
    plt.title("RMSSD Over Time")
    save_plot(p)
    register_chart(p, "RMSSD Over Time", "line", "datetime", "rmssd", len(sdf))

    p = charts_dir / "02_fatigue_over_time.png"
    plt.figure(figsize=(12, 5))
    plt.plot(sdf["datetime"], sdf["fatigue_score"])
    plt.xlabel("Date")
    plt.ylabel("Fatigue Score")
    plt.title("Fatigue Score Over Time")
    save_plot(p)
    register_chart(p, "Fatigue Score Over Time", "line", "datetime", "fatigue_score", len(sdf))

    p = charts_dir / "03_readiness_over_time.png"
    plt.figure(figsize=(12, 5))
    plt.plot(sdf["datetime"], sdf["readiness_score"])
    plt.xlabel("Date")
    plt.ylabel("Readiness Score")
    plt.title("Readiness Score Over Time")
    save_plot(p)
    register_chart(p, "Readiness Score Over Time", "line", "datetime", "readiness_score", len(sdf))

    p = charts_dir / "04_trimp_over_time.png"
    plt.figure(figsize=(12, 5))
    plt.plot(sdf["datetime"], sdf["trimp"])
    plt.xlabel("Date")
    plt.ylabel("TRIMP")
    plt.title("TRIMP Over Time")
    save_plot(p)
    register_chart(p, "TRIMP Over Time", "line", "datetime", "trimp", len(sdf))

    p = charts_dir / "05_trimp_vs_rmssd.png"
    plt.figure(figsize=(7, 6))
    plt.scatter(sdf["trimp"], sdf["rmssd"], alpha=0.7)
    plt.xlabel("TRIMP")
    plt.ylabel("RMSSD (ms)")
    plt.title("TRIMP vs RMSSD")
    save_plot(p)
    register_chart(p, "TRIMP vs RMSSD", "scatter", "trimp", "rmssd", len(sdf))

    p = charts_dir / "06_weekly_rmssd.png"
    plt.figure(figsize=(12, 5))
    plt.plot(weekly_df["week"], weekly_df["avg_rmssd"])
    plt.xlabel("Week")
    plt.ylabel("Average RMSSD (ms)")
    plt.title("Weekly RMSSD Trend")
    plt.xticks(rotation=45)
    save_plot(p)
    register_chart(p, "Weekly RMSSD Trend", "line", "week", "avg_rmssd", len(weekly_df))

    p = charts_dir / "07_weekly_fatigue_readiness.png"
    plt.figure(figsize=(12, 5))
    plt.plot(weekly_df["week"], weekly_df["avg_fatigue"], label="Fatigue")
    plt.plot(weekly_df["week"], weekly_df["avg_readiness"], label="Readiness")
    plt.xlabel("Week")
    plt.ylabel("Score")
    plt.title("Weekly Fatigue and Readiness")
    plt.xticks(rotation=45)
    plt.legend()
    save_plot(p)
    register_chart(p, "Weekly Fatigue and Readiness", "line_multi", "week", "avg_fatigue|avg_readiness", len(weekly_df))

    p = charts_dir / "08_monthly_trimp.png"
    plt.figure(figsize=(12, 5))
    plt.bar(monthly_df["month"], monthly_df["total_trimp"])
    plt.xlabel("Month")
    plt.ylabel("Total TRIMP")
    plt.title("Monthly Training Load")
    plt.xticks(rotation=45)
    save_plot(p)
    register_chart(p, "Monthly Training Load", "bar", "month", "total_trimp", len(monthly_df))

    return chart_rows


def build_report_manifest(
    run_id: str,
    output_dir: Path,
    summary_path: Path,
    daily_path: Path,
    weekly_path: Path,
    monthly_path: Path,
    failed_path: Path,
    log_path: Path,
    chart_rows: List[dict],
) -> pd.DataFrame:
    rows = [
        {
            "artifact_path": str(summary_path),
            "artifact_type": "csv",
            "description": "Per-session batch summary with fatigue, readiness, and TRIMP",
            "run_id": run_id,
        },
        {
            "artifact_path": str(daily_path),
            "artifact_type": "csv",
            "description": "Daily HRV summary",
            "run_id": run_id,
        },
        {
            "artifact_path": str(weekly_path),
            "artifact_type": "csv",
            "description": "Weekly HRV summary",
            "run_id": run_id,
        },
        {
            "artifact_path": str(monthly_path),
            "artifact_type": "csv",
            "description": "Monthly HRV summary",
            "run_id": run_id,
        },
        {
            "artifact_path": str(failed_path),
            "artifact_type": "csv",
            "description": "Failed FIT files report",
            "run_id": run_id,
        },
        {
            "artifact_path": str(log_path),
            "artifact_type": "log",
            "description": "Pipeline execution log",
            "run_id": run_id,
        },
    ]

    for chart in chart_rows:
        rows.append(
            {
                "artifact_path": chart["chart_path"],
                "artifact_type": "chart",
                "description": chart["chart_name"],
                "run_id": run_id,
            }
        )

    manifest_df = pd.DataFrame(rows)
    manifest_csv = output_dir / "report_manifest.csv"
    manifest_df.to_csv(manifest_csv, index=False)

    rows.append(
        {
            "artifact_path": str(manifest_csv),
            "artifact_type": "csv",
            "description": "Report manifest",
            "run_id": run_id,
        }
    )

    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch HRV extraction + charts + fatigue + TRIMP + athlete config + SQLite + operational logging"
    )
    parser.add_argument("input_path", type=Path, help="Folder containing FIT files")
    parser.add_argument("--config", type=Path, default=None, help="Path to athlete JSON config")
    parser.add_argument("--athlete", type=str, default=None, help="Athlete profile name from config")
    parser.add_argument("--window-seconds", type=int, default=60)
    parser.add_argument("--step-seconds", type=int, default=10)
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument("--debug-record-fields", action="store_true")
    parser.add_argument(
        "--db-path",
        type=Path,
        default=Path("c:/smakrykoDBs/Hydra.db"),
        help="Path to SQLite database file",
    )
    args = parser.parse_args()

    athlete_cfg = load_config(args.config, args.athlete)

    input_path = args.input_path
    if not input_path.is_dir():
        raise ValueError("Input must be a folder containing FIT files.")

    fit_files = sorted(input_path.rglob("*.fit"))
    if not fit_files:
        print("No FIT files found.")
        return

    output_dir = args.output_dir or (input_path / "hrv_output")
    output_dir.mkdir(parents=True, exist_ok=True)

    run_id = str(uuid.uuid4())
    log_path = setup_logging(output_dir)

    logging.info(f"Run started. run_id={run_id}")
    logging.info(f"Input folder: {input_path}")
    logging.info(f"Output folder: {output_dir}")
    logging.info(f"DB path: {args.db_path}")

    results: List[dict] = []
    failed_files: List[dict] = []

    conn_for_logs = connect_db(args.db_path)
    create_summary_tables(conn_for_logs)

    try:
        logging.info("=== PROCESSING FILES ===")
        for fit_file in fit_files:
            logging.info(f"Processing file: {fit_file.name}")
            write_processing_log(
                conn_for_logs,
                run_id=run_id,
                level="INFO",
                file=fit_file.name,
                event_type="file_start",
                message="Started processing FIT file",
            )

            try:
                row = process_file(
                    fit_path=fit_file,
                    output_dir=output_dir,
                    window_seconds=args.window_seconds,
                    step_seconds=args.step_seconds,
                    debug=args.debug_record_fields,
                    athlete_cfg=athlete_cfg,
                )

                if row:
                    results.append(row)
                    logging.info(f"Processed successfully: {fit_file.name}")
                    write_processing_log(
                        conn_for_logs,
                        run_id=run_id,
                        level="INFO",
                        file=fit_file.name,
                        event_type="file_success",
                        message="FIT file processed successfully",
                    )
                else:
                    failed_files.append(
                        {
                            "file": fit_file.name,
                            "error_type": "NoHRVData",
                            "error_message": "No valid HRV data found",
                        }
                    )
                    logging.warning(f"No valid HRV data: {fit_file.name}")
                    write_processing_log(
                        conn_for_logs,
                        run_id=run_id,
                        level="WARNING",
                        file=fit_file.name,
                        event_type="file_skip",
                        message="No valid HRV data found",
                    )

            except Exception as e:
                err_text = traceback.format_exc()
                failed_files.append(
                    {
                        "file": fit_file.name,
                        "error_type": type(e).__name__,
                        "error_message": str(e),
                    }
                )
                logging.exception(f"Failed processing file: {fit_file.name}")
                write_processing_log(
                    conn_for_logs,
                    run_id=run_id,
                    level="ERROR",
                    file=fit_file.name,
                    event_type="file_error",
                    message="Exception while processing FIT file",
                    details=err_text,
                )
    finally:
        conn_for_logs.close()

    if not results:
        failed_path = save_failed_files_report(failed_files, output_dir)
        logging.warning("No valid HRV data found in any files.")
        print("\nNo valid HRV data found in any files.")
        print(f"Failed files report: {failed_path}")
        print(f"Log file: {log_path}")
        print(f"Database: {args.db_path}")
        logging.info(f"Run completed with no valid results. run_id={run_id}")
        return

    summary_df = pd.DataFrame(results).sort_values("datetime")
    summary_df = add_trend_fields(summary_df)
    summary_df = fatigue_score_model(summary_df)
    summary_df = combined_readiness_model(summary_df)

    daily_df = make_daily_trends(summary_df)
    weekly_df, monthly_df = make_weekly_monthly_trends(summary_df)

    summary_path = output_dir / "batch_summary_with_fatigue_readiness_trimp.csv"
    daily_path = output_dir / "daily_hrv_trends.csv"
    weekly_path = output_dir / "weekly_hrv_trends.csv"
    monthly_path = output_dir / "monthly_hrv_trends.csv"

    summary_df.to_csv(summary_path, index=False)
    daily_df.to_csv(daily_path, index=False)
    weekly_df.to_csv(weekly_path, index=False)
    monthly_df.to_csv(monthly_path, index=False)

    save_summaries_to_hydra_db(
        db_path=args.db_path,
        summary_df=summary_df,
        daily_df=daily_df,
        weekly_df=weekly_df,
        monthly_df=monthly_df,
        run_id=run_id,
    )

    chart_rows = generate_charts(summary_df, weekly_df, monthly_df, output_dir, run_id)
    save_chart_metadata_to_db(args.db_path, chart_rows)

    failed_path = save_failed_files_report(failed_files, output_dir)

    manifest_df = build_report_manifest(
        run_id=run_id,
        output_dir=output_dir,
        summary_path=summary_path,
        daily_path=daily_path,
        weekly_path=weekly_path,
        monthly_path=monthly_path,
        failed_path=failed_path,
        log_path=log_path,
        chart_rows=chart_rows,
    )
    save_report_manifest_to_db(args.db_path, manifest_df)

    print("\n=== ATHLETE CONFIG USED ===\n")
    print(asdict(athlete_cfg))

    print("\n=== PER-FILE SUMMARY ===\n")
    print(
        summary_df[
            [
                "file",
                "date",
                "rmssd",
                "sdnn",
                "mean_hr",
                "trimp",
                "fatigue_score",
                "fatigue_label",
                "readiness_score",
            ]
        ].to_string(index=False)
    )

    print("\n=== DAILY SUMMARY ===\n")
    print(daily_df.to_string(index=False))

    print("\n=== WEEKLY SUMMARY ===\n")
    print(weekly_df.to_string(index=False))

    print("\n=== MONTHLY SUMMARY ===\n")
    print(monthly_df.to_string(index=False))

    print("\n=== RUN METADATA ===\n")
    print(f"run_id: {run_id}")
    print(f"log file: {log_path}")
    print(f"failed files report: {failed_path}")
    print(f"database: {args.db_path}")

    print("\nSaved files:")
    print(summary_path)
    print(daily_path)
    print(weekly_path)
    print(monthly_path)
    print(output_dir / "charts")
    print(output_dir / "report_manifest.csv")

    logging.info(f"Run completed. run_id={run_id}")


if __name__ == "__main__":
    main()