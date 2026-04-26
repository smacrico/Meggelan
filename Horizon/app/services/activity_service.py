from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.activity import Activity


def upsert_activity(session: Session, values: dict[str, Any]) -> None:
    stmt = insert(Activity).values(**values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_activity_athlete_external",
        set_={
            "activity_type": stmt.excluded.activity_type,
            "start_time_utc": stmt.excluded.start_time_utc,
            "local_start_time": stmt.excluded.local_start_time,
            "duration_sec": stmt.excluded.duration_sec,
            "distance_m": stmt.excluded.distance_m,
            "avg_hr": stmt.excluded.avg_hr,
            "max_hr": stmt.excluded.max_hr,
            "avg_pace_sec_km": stmt.excluded.avg_pace_sec_km,
            "calories": stmt.excluded.calories,
            "training_load": stmt.excluded.training_load,
            "raw_payload_jsonb": stmt.excluded.raw_payload_jsonb,
            "import_batch_id": stmt.excluded.import_batch_id,
            "updated_at": datetime.utcnow(),
        },
    )
    session.execute(stmt)


def latest_activity_date(session: Session):
    return session.scalar(select(Activity.start_time_utc).order_by(Activity.start_time_utc.desc()).limit(1))
