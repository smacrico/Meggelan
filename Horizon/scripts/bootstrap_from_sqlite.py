import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings
from app.core.db import session_scope
from app.core.logging import configure_logging
from app.models.activity import Athlete, ImportBatch
from app.services.activity_service import upsert_activity
from app.pipelines.hrv_analysis import import_hrv_from_sqlite
from app.services.summary_service import refresh_daily_summary


def ensure_athlete(session, timezone_name: str) -> Athlete:
    athlete = session.get(Athlete, 1)
    if athlete:
        return athlete
    athlete = Athlete(id=1, source_name="garmin", timezone=timezone_name, created_at=datetime.now(timezone.utc))
    session.add(athlete)
    session.flush()
    return athlete


def bootstrap_activity_sqlite(session, db_path: Path, timezone_name: str) -> int:
    if not db_path.exists():
        return 0

    athlete = ensure_athlete(session, timezone_name)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    candidates = ["activities", "activity", "garmin_activities"]
    table = None
    for name in candidates:
        row = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone()
        if row:
            table = name
            break

    if table is None:
        conn.close()
        return 0

    batch = ImportBatch(
        source_type="sqlite_bootstrap",
        source_file_name=db_path.name,
        source_checksum=None,
        imported_at=datetime.now(timezone.utc),
        status="success",
        error_message=None,
    )
    session.add(batch)
    session.flush()

    rows = conn.execute(f"SELECT * FROM {table}").fetchall()
    processed = 0
    for row in rows:
        mapping = dict(row)
        external_id = str(mapping.get("external_activity_id") or mapping.get("activity_id") or mapping.get("id"))
        if external_id == "None":
            continue

        start_raw = mapping.get("start_time_utc") or mapping.get("start_time") or mapping.get("start_date")
        start_time = _parse_datetime(start_raw)

        distance_m = _to_float(mapping.get("distance_m") or mapping.get("distance"))
        duration_sec = _to_int(mapping.get("duration_sec") or mapping.get("duration"))
        avg_hr = _to_float(mapping.get("avg_hr") or mapping.get("average_hr"))
        max_hr = _to_float(mapping.get("max_hr"))

        upsert_activity(
            session,
            {
                "athlete_id": athlete.id,
                "external_activity_id": external_id,
                "activity_type": mapping.get("activity_type", "run"),
                "start_time_utc": start_time,
                "local_start_time": start_time,
                "duration_sec": duration_sec,
                "distance_m": distance_m,
                "avg_hr": avg_hr,
                "max_hr": max_hr,
                "avg_pace_sec_km": _to_float(mapping.get("avg_pace_sec_km")),
                "calories": _to_float(mapping.get("calories")),
                "training_load": _to_float(mapping.get("training_load")),
                "raw_payload_jsonb": mapping,
                "import_batch_id": batch.id,
            },
        )
        processed += 1

    conn.close()
    return processed


def _parse_datetime(value):
    if not value:
        return datetime.now(timezone.utc)
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return datetime.now(timezone.utc)


def _to_float(value):
    try:
        return float(value) if value is not None else None
    except (ValueError, TypeError):
        return None


def _to_int(value):
    try:
        return int(value) if value is not None else None
    except (ValueError, TypeError):
        return None


def main() -> int:
    configure_logging()
    settings = get_settings()
    with session_scope() as session:
        total = 0
        total += bootstrap_activity_sqlite(session, settings.garmin_activities_db, settings.athlete_timezone)
        total += bootstrap_activity_sqlite(session, settings.garmin_run_db, settings.athlete_timezone)
        total += import_hrv_from_sqlite(session, settings.hrv_db, settings.athlete_timezone)
        refresh_daily_summary(session, athlete_id=1)
        print(f"Bootstrapped rows: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
