from sqlalchemy.orm import Session

from app.services.summary_service import refresh_daily_summary


def refresh_dashboard_views(session: Session, athlete_id: int = 1) -> int:
    return refresh_daily_summary(session, athlete_id=athlete_id)
