from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class HRVDaily(Base):
    __tablename__ = "hrv_daily"
    __table_args__ = (UniqueConstraint("athlete_id", "metric_date", "source_type", name="uq_hrv_athlete_date_source"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athlete.id"), nullable=False)
    metric_date: Mapped[date] = mapped_column(Date, nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    rmssd: Mapped[float | None] = mapped_column(Float)
    sdnn: Mapped[float | None] = mapped_column(Float)
    resting_hr: Mapped[float | None] = mapped_column(Float)
    readiness_score: Mapped[float | None] = mapped_column(Float)
    baseline_7d: Mapped[float | None] = mapped_column(Float)
    baseline_28d: Mapped[float | None] = mapped_column(Float)
    raw_payload_jsonb: Mapped[dict | None] = mapped_column(JSONB)
