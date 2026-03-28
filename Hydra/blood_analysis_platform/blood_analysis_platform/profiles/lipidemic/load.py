
from __future__ import annotations

import sqlite3
from typing import Iterable

import numpy as np
import pandas as pd


def ensure_target_table(conn: sqlite3.Connection, target_table: str = "lipid_metrics") -> None:
    ddl = f"""
    CREATE TABLE IF NOT EXISTS {target_table} (
        metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_date TEXT NOT NULL UNIQUE,

        total_cholesterol REAL NULL,
        hdl REAL NULL,
        ldl_reported REAL NULL,
        triglycerides REAL NULL,
        reported_non_hdl REAL NULL,
        lpa REAL NULL,

        ldl_friedewald REAL NULL,
        ldl_sampson REAL NULL,
        ldl_final REAL NULL,
        ldl_method TEXT NULL,

        non_hdl_calc REAL NULL,
        non_hdl_final REAL NULL,
        non_hdl_delta_vs_reported REAL NULL,

        tc_hdl_ratio REAL NULL,
        ldl_hdl_ratio REAL NULL,
        tg_hdl_ratio REAL NULL,
        aip REAL NULL,
        remnant_cholesterol REAL NULL,
        vldl_estimated REAL NULL,
        cholesterol_residual_burden REAL NULL,
        lpa_present INTEGER NOT NULL DEFAULT 0,

        tg_status TEXT NULL,
        non_hdl_risk TEXT NULL,
        tc_hdl_risk TEXT NULL,
        ldl_hdl_risk TEXT NULL,
        tg_hdl_risk TEXT NULL,
        aip_risk TEXT NULL,
        remnant_risk TEXT NULL,

        total_cholesterol_prev REAL NULL,
        total_cholesterol_delta REAL NULL,
        total_cholesterol_pct_change REAL NULL,
        total_cholesterol_rolling3 REAL NULL,

        hdl_prev REAL NULL,
        hdl_delta REAL NULL,
        hdl_pct_change REAL NULL,
        hdl_rolling3 REAL NULL,

        ldl_final_prev REAL NULL,
        ldl_final_delta REAL NULL,
        ldl_final_pct_change REAL NULL,
        ldl_final_rolling3 REAL NULL,

        triglycerides_prev REAL NULL,
        triglycerides_delta REAL NULL,
        triglycerides_pct_change REAL NULL,
        triglycerides_rolling3 REAL NULL,

        non_hdl_final_prev REAL NULL,
        non_hdl_final_delta REAL NULL,
        non_hdl_final_pct_change REAL NULL,
        non_hdl_final_rolling3 REAL NULL,

        tc_hdl_ratio_prev REAL NULL,
        tc_hdl_ratio_delta REAL NULL,
        tc_hdl_ratio_pct_change REAL NULL,
        tc_hdl_ratio_rolling3 REAL NULL,

        ldl_hdl_ratio_prev REAL NULL,
        ldl_hdl_ratio_delta REAL NULL,
        ldl_hdl_ratio_pct_change REAL NULL,
        ldl_hdl_ratio_rolling3 REAL NULL,

        tg_hdl_ratio_prev REAL NULL,
        tg_hdl_ratio_delta REAL NULL,
        tg_hdl_ratio_pct_change REAL NULL,
        tg_hdl_ratio_rolling3 REAL NULL,

        aip_prev REAL NULL,
        aip_delta REAL NULL,
        aip_pct_change REAL NULL,
        aip_rolling3 REAL NULL,

        remnant_cholesterol_prev REAL NULL,
        remnant_cholesterol_delta REAL NULL,
        remnant_cholesterol_pct_change REAL NULL,
        remnant_cholesterol_rolling3 REAL NULL,

        lpa_prev REAL NULL,
        lpa_delta REAL NULL,
        lpa_pct_change REAL NULL,
        lpa_rolling3 REAL NULL,

        has_core_lipids INTEGER NOT NULL DEFAULT 0,
        is_complete_profile INTEGER NOT NULL DEFAULT 0,
        record_quality_note TEXT NULL,

        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """
    conn.execute(ddl)
    conn.commit()


def _pythonify(value):
    if pd.isna(value):
        return None
    if isinstance(value, np.generic):
        return value.item()
    return value


def upsert_lipid_metrics(conn: sqlite3.Connection, df: pd.DataFrame, target_table: str = "lipid_metrics") -> None:
    db_df = df.rename(columns={"ldl": "ldl_reported"}).copy()
    if "metric_id" in db_df.columns:
        db_df = db_df.drop(columns=["metric_id"])

    db_df["exam_date"] = pd.to_datetime(db_df["exam_date"], errors="coerce").dt.strftime("%Y-%m-%d")

    columns = list(db_df.columns)
    placeholders = ", ".join(["?"] * len(columns))
    update_clause = ", ".join(
        [f"{col}=excluded.{col}" for col in columns if col != "exam_date"]
        + ["updated_at=CURRENT_TIMESTAMP"]
    )

    sql = f"""
    INSERT INTO {target_table} ({", ".join(columns)})
    VALUES ({placeholders})
    ON CONFLICT(exam_date) DO UPDATE SET
        {update_clause};
    """

    rows = [
        tuple(_pythonify(row[col]) for col in columns)
        for _, row in db_df.iterrows()
    ]

    conn.executemany(sql, rows)
    conn.commit()
