from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class RunMetrics(Base):
    __tablename__ = "run_metrics"

    activity_id: Mapped[int] = mapped_column(ForeignKey("activity.id"), primary_key=True)
    moving_time_sec: Mapped[int | None] = mapped_column(Integer)
    elapsed_time_sec: Mapped[int | None] = mapped_column(Integer)
    avg_cadence: Mapped[float | None] = mapped_column(Float)
    avg_stride_length_m: Mapped[float | None] = mapped_column(Float)
    elevation_gain_m: Mapped[float | None] = mapped_column(Float)
    aerobic_efficiency: Mapped[float | None] = mapped_column(Float)
    decoupling_pct: Mapped[float | None] = mapped_column(Float)
    pace_variability: Mapped[float | None] = mapped_column(Float)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    activity: Mapped["Activity"] = relationship(back_populates="run_metrics")


from app.models.activity import Activity  # noqa: E402
