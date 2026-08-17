# src/ingestion/sqlite_loader.py

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional


DB_PATH = "C:\\smakrykoDBs\\runAnalysis.db"


def to_json(data: Dict[str, Any]) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def numeric_or_none(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def int_or_none(value: Any) -> Optional[int]:
    try:
        if value is None or value == "":
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def calc_file_hash(file_path: str | Path) -> str:
    path = Path(file_path)
    sha = hashlib.sha256()

    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha.update(chunk)

    return sha.hexdigest()


def get_connection(db_path: str = DB_PATH) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def load_activity(
    conn: sqlite3.Connection,
    parsed_fit: Dict[str, Any],
) -> int:
    file_path = Path(parsed_fit["file_path"])
    file_hash = calc_file_hash(file_path)

    existing = conn.execute(
        "SELECT activity_id FROM fit_activity WHERE file_hash = ?",
        (file_hash,),
    ).fetchone()

    if existing:
        return int(existing[0])

    cursor = conn.execute(
        """
        INSERT INTO fit_activity (
            file_path,
            file_name,
            file_hash
        )
        VALUES (?, ?, ?)
        """,
        (
            str(file_path),
            file_path.name,
            file_hash,
        ),
    )

    return int(cursor.lastrowid)


def load_sessions(
    conn: sqlite3.Connection,
    activity_id: int,
    sessions: List[Dict[str, Any]],
) -> None:
    for idx, row in enumerate(sessions):
        conn.execute(
            """
            INSERT INTO fit_session (
                activity_id,
                message_index,
                timestamp,
                start_time,
                sport,
                sub_sport,
                total_elapsed_time,
                total_timer_time,
                total_distance,
                total_cycles,
                total_calories,
                avg_speed,
                max_speed,
                avg_heart_rate,
                max_heart_rate,
                avg_cadence,
                max_cadence,
                total_ascent,
                total_descent,
                training_effect,
                anaerobic_training_effect,
                raw_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                activity_id,
                idx,
                row.get("timestamp"),
                row.get("start_time"),
                row.get("sport"),
                row.get("sub_sport"),
                numeric_or_none(row.get("total_elapsed_time")),
                numeric_or_none(row.get("total_timer_time")),
                numeric_or_none(row.get("total_distance")),
                int_or_none(row.get("total_cycles")),
                int_or_none(row.get("total_calories")),
                numeric_or_none(row.get("avg_speed")),
                numeric_or_none(row.get("max_speed")),
                int_or_none(row.get("avg_heart_rate")),
                int_or_none(row.get("max_heart_rate")),
                int_or_none(row.get("avg_cadence")),
                int_or_none(row.get("max_cadence")),
                int_or_none(row.get("total_ascent")),
                int_or_none(row.get("total_descent")),
                numeric_or_none(row.get("training_effect")),
                numeric_or_none(row.get("anaerobic_training_effect")),
                to_json(row),
            ),
        )


def load_laps(
    conn: sqlite3.Connection,
    activity_id: int,
    laps: List[Dict[str, Any]],
) -> None:
    for idx, row in enumerate(laps):
        conn.execute(
            """
            INSERT INTO fit_lap (
                activity_id,
                message_index,
                timestamp,
                start_time,
                total_elapsed_time,
                total_timer_time,
                total_distance,
                total_calories,
                avg_speed,
                max_speed,
                avg_heart_rate,
                max_heart_rate,
                avg_cadence,
                max_cadence,
                total_ascent,
                total_descent,
                raw_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                activity_id,
                idx,
                row.get("timestamp"),
                row.get("start_time"),
                numeric_or_none(row.get("total_elapsed_time")),
                numeric_or_none(row.get("total_timer_time")),
                numeric_or_none(row.get("total_distance")),
                int_or_none(row.get("total_calories")),
                numeric_or_none(row.get("avg_speed")),
                numeric_or_none(row.get("max_speed")),
                int_or_none(row.get("avg_heart_rate")),
                int_or_none(row.get("max_heart_rate")),
                int_or_none(row.get("avg_cadence")),
                int_or_none(row.get("max_cadence")),
                int_or_none(row.get("total_ascent")),
                int_or_none(row.get("total_descent")),
                to_json(row),
            ),
        )


def load_records(
    conn: sqlite3.Connection,
    activity_id: int,
    records: List[Dict[str, Any]],
) -> None:
    for idx, row in enumerate(records):
        conn.execute(
            """
            INSERT INTO fit_record (
                activity_id,
                message_index,
                timestamp,
                position_lat,
                position_long,
                distance,
                speed,
                enhanced_speed,
                altitude,
                enhanced_altitude,
                heart_rate,
                cadence,
                fractional_cadence,
                temperature,
                raw_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                activity_id,
                idx,
                row.get("timestamp"),
                numeric_or_none(row.get("position_lat")),
                numeric_or_none(row.get("position_long")),
                numeric_or_none(row.get("distance")),
                numeric_or_none(row.get("speed")),
                numeric_or_none(row.get("enhanced_speed")),
                numeric_or_none(row.get("altitude")),
                numeric_or_none(row.get("enhanced_altitude")),
                int_or_none(row.get("heart_rate")),
                int_or_none(row.get("cadence")),
                numeric_or_none(row.get("fractional_cadence")),
                int_or_none(row.get("temperature")),
                to_json(row),
            ),
        )


def load_hrv(
    conn: sqlite3.Connection,
    activity_id: int,
    hrv_rows: List[Dict[str, Any]],
) -> None:
    for idx, row in enumerate(hrv_rows):
        rr_values = row.get("time") or row.get("rr_interval") or row.get("rr_intervals")

        if isinstance(rr_values, list):
            for rr in rr_values:
                conn.execute(
                    """
                    INSERT INTO fit_hrv (
                        activity_id,
                        message_index,
                        timestamp,
                        rr_interval_ms,
                        raw_value,
                        raw_json
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        activity_id,
                        idx,
                        row.get("timestamp"),
                        numeric_or_none(rr) * 1000 if numeric_or_none(rr) else None,
                        numeric_or_none(rr),
                        to_json(row),
                    ),
                )
        else:
            conn.execute(
                """
                INSERT INTO fit_hrv (
                    activity_id,
                    message_index,
                    timestamp,
                    rr_interval_ms,
                    raw_value,
                    raw_json
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    activity_id,
                    idx,
                    row.get("timestamp"),
                    numeric_or_none(rr_values) * 1000 if numeric_or_none(rr_values) else None,
                    numeric_or_none(rr_values),
                    to_json(row),
                ),
            )


def load_running_dynamics(
    conn: sqlite3.Connection,
    activity_id: int,
    rows: List[Dict[str, Any]],
) -> None:
    for idx, row in enumerate(rows):
        conn.execute(
            """
            INSERT INTO fit_running_dynamics (
                activity_id,
                message_index,
                timestamp,
                cadence,
                fractional_cadence,
                stride_length,
                vertical_oscillation,
                vertical_ratio,
                stance_time,
                stance_time_balance,
                ground_contact_time,
                ground_contact_time_balance,
                raw_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                activity_id,
                idx,
                row.get("timestamp"),
                int_or_none(row.get("cadence")),
                numeric_or_none(row.get("fractional_cadence")),
                numeric_or_none(row.get("stride_length")),
                numeric_or_none(row.get("vertical_oscillation")),
                numeric_or_none(row.get("vertical_ratio")),
                numeric_or_none(row.get("stance_time")),
                numeric_or_none(row.get("stance_time_balance")),
                numeric_or_none(row.get("ground_contact_time")),
                numeric_or_none(row.get("ground_contact_time_balance")),
                to_json(row),
            ),
        )


def load_developer_fields(
    conn: sqlite3.Connection,
    activity_id: int,
    rows: List[Dict[str, Any]],
) -> None:
    for row in rows:
        value = row.get("value")

        conn.execute(
            """
            INSERT INTO fit_developer_field (
                activity_id,
                message_name,
                field_name,
                value_text,
                value_numeric,
                units,
                raw_value,
                raw_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                activity_id,
                row.get("message_name"),
                row.get("field_name"),
                None if value is None else str(value),
                numeric_or_none(value),
                row.get("units"),
                None if row.get("raw_value") is None else str(row.get("raw_value")),
                to_json(row),
            ),
        )


def load_parsed_fit(
    parsed_fit: Dict[str, Any],
    db_path: str = DB_PATH,
) -> int:
    """
    Main loader.

    Usage:
        parsed = parse_fit_file("activity.fit")
        activity_id = load_parsed_fit(parsed)
    """
    with get_connection(db_path) as conn:
        activity_id = load_activity(conn, parsed_fit)

        load_sessions(conn, activity_id, parsed_fit.get("sessions", []))
        load_laps(conn, activity_id, parsed_fit.get("laps", []))
        load_records(conn, activity_id, parsed_fit.get("records", []))
        load_hrv(conn, activity_id, parsed_fit.get("hrv", []))
        load_running_dynamics(conn, activity_id, parsed_fit.get("running_dynamics", []))
        load_developer_fields(conn, activity_id, parsed_fit.get("developer_fields", []))

        conn.commit()

    return activity_id