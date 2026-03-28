
from __future__ import annotations

import sqlite3
import pandas as pd


def load_lipid_raw(conn: sqlite3.Connection, source_table: str = "lipid_raw") -> pd.DataFrame:
    df = pd.read_sql_query(f"SELECT * FROM {source_table}", conn)
    if df.empty:
        return df

    df.columns = [c.strip().lower().replace(" ", "_").replace("(", "").replace(")", "") for c in df.columns]

    # normalize common source column variants
    rename_map = {
        "exam_date": "exam_date",
        "date": "exam_date",
        "total_cholesterol": "total_cholesterol",
        "cholesterol": "total_cholesterol",
        "hdl": "hdl",
        "ldl": "ldl",
        "triglycerides": "triglycerides",
        "tg": "triglycerides",
        "reported_non-hdl": "reported_non_hdl",
        "reported_non_hdl": "reported_non_hdl",
        "non_hdl": "reported_non_hdl",
        "reported_nonhdl": "reported_non_hdl",
        "lpa": "lpa",
        "lpa_": "lpa",
        "lp_a": "lpa",
    }
    normalized = {}
    for col in df.columns:
        key = col.replace("-", "_")
        normalized[col] = rename_map.get(key, key)
    df = df.rename(columns=normalized)

    required = ["exam_date", "total_cholesterol", "hdl", "triglycerides"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required source columns in {source_table}: {missing}")

    for col in ["total_cholesterol", "hdl", "ldl", "triglycerides", "reported_non_hdl", "lpa"]:
        if col not in df.columns:
            df[col] = None

    df["exam_date"] = pd.to_datetime(df["exam_date"], errors="coerce").dt.date
    for col in ["total_cholesterol", "hdl", "ldl", "triglycerides", "reported_non_hdl", "lpa"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.sort_values("exam_date").reset_index(drop=True)
    return df
