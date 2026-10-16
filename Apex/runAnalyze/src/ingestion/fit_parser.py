# src/ingestion/fit_parser.py

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional
from fitparse import FitFile


def safe_value(value: Any) -> Any:
    """Convert FIT values into database-safe Python values."""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def field_to_dict(field: Any) -> Dict[str, Any]:
    """Convert a FIT field object to a normalized dictionary."""
    return {
        "name": field.name,
        "value": safe_value(field.value),
        "units": getattr(field, "units", None),
        "raw_value": safe_value(getattr(field, "raw_value", None)),
    }


def parse_fit_file(file_path: str | Path) -> Dict[str, Any]:
    """
    Parse a FIT file and return all important message groups.

    Returns:
        {
          "file_path": "...",
          "sessions": [...],
          "laps": [...],
          "records": [...],
          "hrv": [...],
          "running_dynamics": [...],
          "developer_fields": [...]
        }
    """
    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"FIT file not found: {file_path}")

    fitfile = FitFile(str(file_path))

    return {
        "file_path": str(file_path),
        "sessions": parse_session_messages(fitfile),
        "laps": parse_lap_messages(fitfile),
        "records": parse_record_messages(fitfile),
        "hrv": parse_hrv_messages(fitfile),
        "running_dynamics": parse_running_dynamics_fields(fitfile),
        "developer_fields": parse_developer_fields(fitfile),
    }


def parse_session_messages(fitfile: FitFile) -> List[Dict[str, Any]]:
    """Parse FIT session messages."""
    sessions: List[Dict[str, Any]] = []

    for message in fitfile.get_messages("session"):
        row = {}

        for field in message:
            row[field.name] = safe_value(field.value)

        sessions.append(row)

    return sessions


def parse_lap_messages(fitfile: FitFile) -> List[Dict[str, Any]]:
    """Parse FIT lap messages."""
    laps: List[Dict[str, Any]] = []

    for message in fitfile.get_messages("lap"):
        row = {}

        for field in message:
            row[field.name] = safe_value(field.value)

        laps.append(row)

    return laps


def parse_record_messages(fitfile: FitFile) -> List[Dict[str, Any]]:
    """
    Parse FIT record messages.

    These are usually the most important time-series points:
    timestamp, HR, cadence, speed, distance, altitude, GPS, temperature.
    """
    records: List[Dict[str, Any]] = []

    for message in fitfile.get_messages("record"):
        row = {}

        for field in message:
            row[field.name] = safe_value(field.value)

        records.append(row)

    return records


def parse_hrv_messages(fitfile: FitFile) -> List[Dict[str, Any]]:
    """
    Parse HRV/RR interval messages if present.

    FIT HRV message commonly stores RR intervals as time values.
    Not all Forerunner 245 activity FIT files contain this data.
    """
    hrv_rows: List[Dict[str, Any]] = []

    for message in fitfile.get_messages("hrv"):
        row = {}

        for field in message:
            row[field.name] = safe_value(field.value)

        hrv_rows.append(row)

    return hrv_rows


def parse_running_dynamics_fields(fitfile: FitFile) -> List[Dict[str, Any]]:
    """
    Extract running dynamics fields from record messages.

    For Forerunner 245, these require a compatible accessory:
    HRM-Run, HRM-Tri, HRM-Pro, or Running Dynamics Pod.
    """
    dynamic_fields = {
        "cadence",
        "fractional_cadence",
        "stride_length",
        "vertical_oscillation",
        "vertical_ratio",
        "stance_time",
        "stance_time_balance",
        "ground_contact_time",
        "ground_contact_time_balance",
    }

    rows: List[Dict[str, Any]] = []

    for message in fitfile.get_messages("record"):
        row = {}

        for field in message:
            if field.name in dynamic_fields:
                row[field.name] = safe_value(field.value)

        if row:
            timestamp_field = message.get_value("timestamp")
            row["timestamp"] = safe_value(timestamp_field)
            rows.append(row)

    return rows


def parse_developer_fields(fitfile: FitFile) -> List[Dict[str, Any]]:
    """
    Parse developer fields from all FIT messages.

    Developer fields are used by Garmin apps, Connect IQ apps,
    external sensors, or third-party data fields.
    """
    developer_rows: List[Dict[str, Any]] = []

    for message in fitfile.get_messages():
        message_name = message.name

        for field in message:
            is_developer_field = getattr(field, "is_developer_field", False)

            if is_developer_field:
                developer_rows.append(
                    {
                        "message_name": message_name,
                        "field_name": field.name,
                        "value": safe_value(field.value),
                        "units": getattr(field, "units", None),
                        "raw_value": safe_value(getattr(field, "raw_value", None)),
                    }
                )

    return developer_rows


def parse_all_messages_raw(fitfile: FitFile) -> List[Dict[str, Any]]:
    """
    Optional helper: parse every FIT message into raw normalized rows.
    Useful for debugging unknown fields.
    """
    rows: List[Dict[str, Any]] = []

    for message in fitfile.get_messages():
        row = {
            "message_name": message.name,
            "fields": [field_to_dict(field) for field in message],
        }

        rows.append(row)

    return rows