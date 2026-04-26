from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Athlete(Base):
    __tablename__ = "athlete"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_name: Mapped[str] = mapped_column(String(100), nullable=False, default="garmin")
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    activities: Mapped[list["Activity"]] = relationship(back_populates="athlete")


class ImportBatch(Base):
    __tablename__ = "import_batch"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_file_name: Mapped[str | None] = mapped_column(String(255))
    source_checksum: Mapped[str | None] = mapped_column(String(128))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text())

    activities: Mapped[list["Activity"]] = relationship(back_populates="import_batch")


class Activity(Base, TimestampMixin):
    __tablename__ = "activity"
    __table_args__ = (UniqueConstraint("athlete_id", "external_activity_id", name="uq_activity_athlete_external"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    athlete_id: Mapped[int] = mapped_column(ForeignKey("athlete.id"), nullable=False)
    external_activity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    start_time_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    local_start_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    distance_m: Mapped[float | None] = mapped_column(Float)
    avg_hr: Mapped[float | None] = mapped_column(Float)
    max_hr: Mapped[float | None] = mapped_column(Float)
    avg_pace_sec_km: Mapped[float | None] = mapped_column(Float)
    calories: Mapped[float | None] = mapped_column(Float)
    training_load: Mapped[float | None] = mapped_column(Float)
    raw_payload_jsonb: Mapped[dict | None] = mapped_column(JSONB)
    import_batch_id: Mapped[int | None] = mapped_column(ForeignKey("import_batch.id"))

    athlete: Mapped["Athlete"] = relationship(back_populates="activities")
    import_batch: Mapped["ImportBatch"] = relationship(back_populates="activities")
    streams: Mapped[list["ActivityStream"]] = relationship(back_populates="activity", cascade="all, delete-orphan")
    run_metrics: Mapped["RunMetrics | None"] = relationship(back_populates="activity", uselist=False)

class ActivityStream(Base):
    __tablename__ = "activity_stream"
    __table_args__ = (UniqueConstraint("activity_id", "stream_type", "seq_no", name="uq_stream_activity_type_seq"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activity.id"), nullable=False)
    stream_type: Mapped[str] = mapped_column(String(50), nullable=False)
    seq_no: Mapped[int] = mapped_column(Integer, nullable=False)
    value_num: Mapped[float | None] = mapped_column(Float)

    activity: Mapped["Activity"] = relationship(back_populates="streams")


from app.models.workout import RunMetrics  # noqa: E402
