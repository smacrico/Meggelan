import sqlite3
from collections import deque
from datetime import date

from sqlalchemy.orm import Session

from app.models.activity import Athlete
from app.services.hrv_service import compute_readiness, rolling_baseline, upsert_hrv_daily


def ensure_default_athlete(session: Session, timezone_name: str) -> Athlete:
    athlete = session.get(Athlete, 1)
    if athlete:
        return athlete
    athlete = Athlete(id=1, source_name="hrv", timezone=timezone_name, created_at=date.today())  # type: ignore[arg-type]
    session.add(athlete)
    session.flush()
    return athlete


def import_hrv_from_sqlite(session: Session, sqlite_path, timezone_name: str) -> int:
    athlete = ensure_default_athlete(session, timezone_name)
    if not sqlite_path.exists():
        return 0

    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    candidates = ["hrv_daily", "daily_hrv", "hrv"]
    table = None
    for name in candidates:
        exists = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone()
        if exists:
            table = name
            break
    if table is None:
        return 0

    rows = conn.execute(f"SELECT * FROM {table} ORDER BY metric_date ASC").fetchall()
    history = deque(maxlen=28)
    processed = 0
    for row in rows:
        mapping = dict(row)
        metric_date = mapping.get("metric_date") or mapping.get("date")
        if metric_date is None:
            continue
        metric_date = date.fromisoformat(str(metric_date))
        rmssd = _to_float(mapping.get("rmssd"))
        resting_hr = _to_float(mapping.get("resting_hr") or mapping.get("rhr"))
        baseline_7d = rolling_baseline(list(history)[-7:])
        baseline_28d = rolling_baseline(list(history))
        readiness_score = compute_readiness(rmssd, resting_hr, baseline_7d or baseline_28d)
        upsert_hrv_daily(
            session,
            {
                "athlete_id": athlete.id,
                "metric_date": metric_date,
                "source_type": "sqlite_hrv",
                "rmssd": rmssd,
                "sdnn": _to_float(mapping.get("sdnn")),
                "resting_hr": resting_hr,
                "readiness_score": readiness_score,
                "baseline_7d": baseline_7d,
                "baseline_28d": baseline_28d,
                "raw_payload_jsonb": mapping,
            },
        )
        if rmssd is not None:
            history.append(rmssd)
        processed += 1
    conn.close()
    return processed


def _to_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
