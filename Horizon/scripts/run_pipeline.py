from datetime import datetime, timezone
import logging
import sys

from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import session_scope
from app.core.logging import configure_logging
from app.models.summary import JobRun
from app.pipelines.garmin_import import import_garmin_exports
from app.pipelines.hrv_analysis import import_hrv_from_sqlite
from app.pipelines.materialized_views import refresh_dashboard_views
from app.pipelines.run_analysis import compute_run_metrics

logger = logging.getLogger(__name__)


def try_acquire_lock(session, lock_key: str) -> bool:
    lock_id = abs(hash(lock_key)) % (2**31)
    return bool(session.execute(text("SELECT pg_try_advisory_lock(:lock_id)"), {"lock_id": lock_id}).scalar())


def release_lock(session, lock_key: str) -> None:
    lock_id = abs(hash(lock_key)) % (2**31)
    session.execute(text("SELECT pg_advisory_unlock(:lock_id)"), {"lock_id": lock_id})


def main() -> int:
    configure_logging()
    settings = get_settings()

    with session_scope() as session:
        if not try_acquire_lock(session, settings.pipeline_lock_key):
            logger.warning("Pipeline lock already held, skipping run.")
            return 0

        job = JobRun(job_name="garmin-main", started_at=datetime.now(timezone.utc), status="running")
        session.add(job)
        session.flush()

        inserted = 0
        updated = 0

        try:
            stats = import_garmin_exports(session, settings.garmin_import_path, settings.athlete_timezone)
            inserted += stats.get("activities_processed", 0)

            hrv_rows = import_hrv_from_sqlite(session, settings.hrv_db, settings.athlete_timezone)
            updated += hrv_rows

            run_rows = compute_run_metrics(session)
            updated += run_rows

            summary_rows = refresh_dashboard_views(session, athlete_id=1)
            updated += summary_rows

            job.status = "success"
            job.rows_inserted = inserted
            job.rows_updated = updated
            job.finished_at = datetime.now(timezone.utc)
            logger.info("Pipeline completed. inserted=%s updated=%s", inserted, updated)
        except Exception as exc:
            logger.exception("Pipeline failed")
            job.status = "failed"
            job.error_message = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            raise
        finally:
            release_lock(session, settings.pipeline_lock_key)

    return 0


if __name__ == "__main__":
    sys.exit(main())
