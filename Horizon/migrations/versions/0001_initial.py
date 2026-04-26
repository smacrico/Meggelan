"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-11 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "athlete",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_name", sa.String(length=100), nullable=False),
        sa.Column("timezone", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "import_batch",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_file_name", sa.String(length=255)),
        sa.Column("source_checksum", sa.String(length=128)),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("error_message", sa.Text()),
    )

    op.create_table(
        "job_run",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("job_name", sa.String(length=100), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("rows_inserted", sa.Integer()),
        sa.Column("rows_updated", sa.Integer()),
        sa.Column("error_message", sa.Text()),
    )

    op.create_table(
        "activity",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("athlete_id", sa.Integer(), sa.ForeignKey("athlete.id"), nullable=False),
        sa.Column("external_activity_id", sa.String(length=100), nullable=False),
        sa.Column("activity_type", sa.String(length=50), nullable=False),
        sa.Column("start_time_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("local_start_time", sa.DateTime(timezone=True)),
        sa.Column("duration_sec", sa.Integer()),
        sa.Column("distance_m", sa.Float()),
        sa.Column("avg_hr", sa.Float()),
        sa.Column("max_hr", sa.Float()),
        sa.Column("avg_pace_sec_km", sa.Float()),
        sa.Column("calories", sa.Float()),
        sa.Column("training_load", sa.Float()),
        sa.Column("raw_payload_jsonb", postgresql.JSONB(astext_type=sa.Text())),
        sa.Column("import_batch_id", sa.Integer(), sa.ForeignKey("import_batch.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("athlete_id", "external_activity_id", name="uq_activity_athlete_external"),
    )

    op.create_table(
        "activity_stream",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activity.id"), nullable=False),
        sa.Column("stream_type", sa.String(length=50), nullable=False),
        sa.Column("seq_no", sa.Integer(), nullable=False),
        sa.Column("value_num", sa.Float()),
        sa.UniqueConstraint("activity_id", "stream_type", "seq_no", name="uq_stream_activity_type_seq"),
    )

    op.create_table(
        "run_metrics",
        sa.Column("activity_id", sa.Integer(), sa.ForeignKey("activity.id"), primary_key=True),
        sa.Column("moving_time_sec", sa.Integer()),
        sa.Column("elapsed_time_sec", sa.Integer()),
        sa.Column("avg_cadence", sa.Float()),
        sa.Column("avg_stride_length_m", sa.Float()),
        sa.Column("elevation_gain_m", sa.Float()),
        sa.Column("aerobic_efficiency", sa.Float()),
        sa.Column("decoupling_pct", sa.Float()),
        sa.Column("pace_variability", sa.Float()),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "hrv_daily",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("athlete_id", sa.Integer(), sa.ForeignKey("athlete.id"), nullable=False),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("rmssd", sa.Float()),
        sa.Column("sdnn", sa.Float()),
        sa.Column("resting_hr", sa.Float()),
        sa.Column("readiness_score", sa.Float()),
        sa.Column("baseline_7d", sa.Float()),
        sa.Column("baseline_28d", sa.Float()),
        sa.Column("raw_payload_jsonb", postgresql.JSONB(astext_type=sa.Text())),
        sa.UniqueConstraint("athlete_id", "metric_date", "source_type", name="uq_hrv_athlete_date_source"),
    )

    op.create_table(
        "daily_summary",
        sa.Column("athlete_id", sa.Integer(), primary_key=True),
        sa.Column("summary_date", sa.Date(), primary_key=True),
        sa.Column("total_distance_m", sa.Float()),
        sa.Column("total_duration_sec", sa.Integer()),
        sa.Column("training_load", sa.Float()),
        sa.Column("run_count", sa.Integer()),
        sa.Column("avg_hrv_rmssd", sa.Float()),
        sa.Column("readiness_score", sa.Float()),
    )


def downgrade() -> None:
    op.drop_table("daily_summary")
    op.drop_table("hrv_daily")
    op.drop_table("run_metrics")
    op.drop_table("activity_stream")
    op.drop_table("activity")
    op.drop_table("job_run")
    op.drop_table("import_batch")
    op.drop_table("athlete")
