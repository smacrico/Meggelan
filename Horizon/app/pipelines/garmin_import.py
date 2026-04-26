import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.activity import Athlete, ImportBatch
from app.services.activity_service import upsert_activity

logger = logging.getLogger(__name__)


def _checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ensure_default_athlete(session: Session, timezone_name: str) -> Athlete:
    athlete = session.get(Athlete, 1)
    if athlete:
        return athlete
    athlete = Athlete(id=1, source_name="garmin", timezone=timezone_name, created_at=datetime.now(timezone.utc))
    session.add(athlete)
    session.flush()
    return athlete


def import_garmin_exports(session: Session, import_dir: Path, timezone_name: str) -> dict[str, int]:
    athlete = ensure_default_athlete(session, timezone_name)
    inserted = 0
    for path in sorted(import_dir.glob("*.json")):
        try:
            payload = json.loads(path.read_text())
            batch = ImportBatch(
                source_type="garmin_export",
                source_file_name=path.name,
                source_checksum=_checksum(path),
                imported_at=datetime.now(timezone.utc),
                status="success",
                error_message=None,
            )
            session.add(batch)
            session.flush()

            activity_id = str(payload.get("activityId") or payload.get("id") or path.stem)
            start_raw = payload.get("startTimeUTC") or payload.get("start_time_utc")
            start_time = datetime.fromisoformat(start_raw.replace("Z", "+00:00")) if start_raw else datetime.now(timezone.utc)

            distance_m = payload.get("distance") or payload.get("distance_m")
            duration_sec = payload.get("duration") or payload.get("duration_sec")
            avg_hr = payload.get("averageHR") or payload.get("avg_hr")
            max_hr = payload.get("maxHR") or payload.get("max_hr")

            upsert_activity(
                session,
                {
                    "athlete_id": athlete.id,
                    "external_activity_id": activity_id,
                    "activity_type": payload.get("activityType", "run"),
                    "start_time_utc": start_time,
                    "local_start_time": start_time,
                    "duration_sec": int(duration_sec) if duration_sec is not None else None,
                    "distance_m": float(distance_m) if distance_m is not None else None,
                    "avg_hr": float(avg_hr) if avg_hr is not None else None,
                    "max_hr": float(max_hr) if max_hr is not None else None,
                    "avg_pace_sec_km": payload.get("avg_pace_sec_km"),
                    "calories": payload.get("calories"),
                    "training_load": payload.get("training_load"),
                    "raw_payload_jsonb": payload,
                    "import_batch_id": batch.id,
                },
            )
            inserted += 1
        except Exception as exc:
            logger.exception("Failed to import %s", path)
            session.add(
                ImportBatch(
                    source_type="garmin_export",
                    source_file_name=path.name,
                    source_checksum=None,
                    imported_at=datetime.now(timezone.utc),
                    status="failed",
                    error_message=str(exc),
                )
            )
    return {"activities_processed": inserted}
