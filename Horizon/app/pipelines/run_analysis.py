from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.models.workout import RunMetrics


def compute_run_metrics(session: Session) -> int:
    rows = session.execute(
        select(Activity).where(Activity.activity_type.ilike("run"))
    ).scalars().all()

    processed = 0
    for activity in rows:
        moving_time = activity.duration_sec
        pace_variability = None
        if activity.distance_m and activity.duration_sec:
            pace_variability = round((activity.duration_sec / max(activity.distance_m / 1000.0, 0.001)), 2)

        stmt = insert(RunMetrics).values(
            activity_id=activity.id,
            moving_time_sec=moving_time,
            elapsed_time_sec=activity.duration_sec,
            avg_cadence=None,
            avg_stride_length_m=None,
            elevation_gain_m=None,
            aerobic_efficiency=None,
            decoupling_pct=None,
            pace_variability=pace_variability,
            computed_at=datetime.now(timezone.utc),
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[RunMetrics.activity_id],
            set_={
                "moving_time_sec": stmt.excluded.moving_time_sec,
                "elapsed_time_sec": stmt.excluded.elapsed_time_sec,
                "pace_variability": stmt.excluded.pace_variability,
                "computed_at": stmt.excluded.computed_at,
            },
        )
        session.execute(stmt)
        processed += 1
    return processed
