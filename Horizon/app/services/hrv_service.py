from statistics import mean

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.hrv import HRVDaily


def upsert_hrv_daily(session: Session, values: dict) -> None:
    stmt = insert(HRVDaily).values(**values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_hrv_athlete_date_source",
        set_={
            "rmssd": stmt.excluded.rmssd,
            "sdnn": stmt.excluded.sdnn,
            "resting_hr": stmt.excluded.resting_hr,
            "readiness_score": stmt.excluded.readiness_score,
            "baseline_7d": stmt.excluded.baseline_7d,
            "baseline_28d": stmt.excluded.baseline_28d,
            "raw_payload_jsonb": stmt.excluded.raw_payload_jsonb,
        },
    )
    session.execute(stmt)


def compute_readiness(rmssd: float | None, resting_hr: float | None, baseline: float | None) -> float | None:
    if rmssd is None:
        return None
    if baseline in (None, 0):
        return rmssd
    readiness = (rmssd / baseline) * 100.0
    if resting_hr:
        readiness -= max(resting_hr - 50.0, 0) * 0.5
    return round(readiness, 2)


def rolling_baseline(values: list[float]) -> float | None:
    return round(mean(values), 2) if values else None


def latest_hrv_date(session: Session):
    return session.scalar(select(HRVDaily.metric_date).order_by(HRVDaily.metric_date.desc()).limit(1))
