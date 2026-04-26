from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.models.hrv import HRVDaily
from app.models.summary import DailySummary


def refresh_daily_summary(session: Session, athlete_id: int) -> int:
    session.execute(delete(DailySummary).where(DailySummary.athlete_id == athlete_id))

    activity_rows = (
        session.execute(
            select(
                Activity.athlete_id.label("athlete_id"),
                func.date(Activity.start_time_utc).label("summary_date"),
                func.sum(Activity.distance_m).label("total_distance_m"),
                func.sum(Activity.duration_sec).label("total_duration_sec"),
                func.sum(Activity.training_load).label("training_load"),
                func.count().label("run_count"),
            )
            .where(Activity.athlete_id == athlete_id)
            .group_by(Activity.athlete_id, func.date(Activity.start_time_utc))
        )
        .mappings()
        .all()
    )

    hrv_rows = {
        (r["athlete_id"], r["summary_date"]): r
        for r in session.execute(
            select(
                HRVDaily.athlete_id.label("athlete_id"),
                HRVDaily.metric_date.label("summary_date"),
                func.avg(HRVDaily.rmssd).label("avg_hrv_rmssd"),
                func.avg(HRVDaily.readiness_score).label("readiness_score"),
            )
            .where(HRVDaily.athlete_id == athlete_id)
            .group_by(HRVDaily.athlete_id, HRVDaily.metric_date)
        ).mappings()
    }

    for row in activity_rows:
        hrv = hrv_rows.get((row["athlete_id"], row["summary_date"]))
        session.add(
            DailySummary(
                athlete_id=row["athlete_id"],
                summary_date=row["summary_date"],
                total_distance_m=row["total_distance_m"] or 0,
                total_duration_sec=row["total_duration_sec"] or 0,
                training_load=row["training_load"] or 0,
                run_count=row["run_count"] or 0,
                avg_hrv_rmssd=hrv["avg_hrv_rmssd"] if hrv else None,
                readiness_score=hrv["readiness_score"] if hrv else None,
            )
        )

    return len(activity_rows)
