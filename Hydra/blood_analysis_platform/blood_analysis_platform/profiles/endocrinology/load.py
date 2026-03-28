from __future__ import annotations

import sqlite3

import numpy as np
import pandas as pd


ENDO_COLUMN_DEFS = [
    ("exam_date", "TEXT PRIMARY KEY"),
    ("glucose_for_calc", "REAL NULL"),
    ("fasting_insulin", "REAL NULL"),
    ("hba1c", "REAL NULL"),
    ("tsh", "REAL NULL"),
    ("free_t4", "REAL NULL"),
    ("vitamin_d_25_oh", "REAL NULL"),
    ("homa_ir", "REAL NULL"),
    ("quicki", "REAL NULL"),
    ("eag_mgdl", "REAL NULL"),
    ("tsh_free_t4_ratio", "REAL NULL"),
    ("vitamin_d_status", "TEXT NULL"),
    ("homa_ir_interpretation", "TEXT NULL"),
    ("glucose_for_calc_prev", "REAL NULL"),
    ("glucose_for_calc_delta", "REAL NULL"),
    ("glucose_for_calc_pct_change", "REAL NULL"),
    ("glucose_for_calc_rolling3", "REAL NULL"),
    ("fasting_insulin_prev", "REAL NULL"),
    ("fasting_insulin_delta", "REAL NULL"),
    ("fasting_insulin_pct_change", "REAL NULL"),
    ("fasting_insulin_rolling3", "REAL NULL"),
    ("hba1c_prev", "REAL NULL"),
    ("hba1c_delta", "REAL NULL"),
    ("hba1c_pct_change", "REAL NULL"),
    ("hba1c_rolling3", "REAL NULL"),
    ("tsh_prev", "REAL NULL"),
    ("tsh_delta", "REAL NULL"),
    ("tsh_pct_change", "REAL NULL"),
    ("tsh_rolling3", "REAL NULL"),
    ("free_t4_prev", "REAL NULL"),
    ("free_t4_delta", "REAL NULL"),
    ("free_t4_pct_change", "REAL NULL"),
    ("free_t4_rolling3", "REAL NULL"),
    ("vitamin_d_25_oh_prev", "REAL NULL"),
    ("vitamin_d_25_oh_delta", "REAL NULL"),
    ("vitamin_d_25_oh_pct_change", "REAL NULL"),
    ("vitamin_d_25_oh_rolling3", "REAL NULL"),
    ("homa_ir_prev", "REAL NULL"),
    ("homa_ir_delta", "REAL NULL"),
    ("homa_ir_pct_change", "REAL NULL"),
    ("homa_ir_rolling3", "REAL NULL"),
    ("quicki_prev", "REAL NULL"),
    ("quicki_delta", "REAL NULL"),
    ("quicki_pct_change", "REAL NULL"),
    ("quicki_rolling3", "REAL NULL"),
    ("eag_mgdl_prev", "REAL NULL"),
    ("eag_mgdl_delta", "REAL NULL"),
    ("eag_mgdl_pct_change", "REAL NULL"),
    ("eag_mgdl_rolling3", "REAL NULL"),
    ("tsh_free_t4_ratio_prev", "REAL NULL"),
    ("tsh_free_t4_ratio_delta", "REAL NULL"),
    ("tsh_free_t4_ratio_pct_change", "REAL NULL"),
    ("tsh_free_t4_ratio_rolling3", "REAL NULL"),
    ("has_core_endocrine", "INTEGER NOT NULL DEFAULT 0"),
    ("is_complete_profile", "INTEGER NOT NULL DEFAULT 0"),
    ("record_quality_note", "TEXT NULL"),
]

ENDO_METRICS_COLUMNS = [name for name, _ in ENDO_COLUMN_DEFS]


def _sanitize_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, np.generic):
        return value.item()
    return value


def _get_existing_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    return {row[1] for row in rows}


def ensure_endo_metrics_table(conn: sqlite3.Connection, target_table: str = "endo_metrics") -> None:
    create_cols = ",\n        ".join([f'"{name}" {col_type}' for name, col_type in ENDO_COLUMN_DEFS])

    ddl = f"""
    CREATE TABLE IF NOT EXISTS "{target_table}" (
        {create_cols}
    );
    """
    conn.execute(ddl)

    existing_columns = _get_existing_columns(conn, target_table)

    for name, col_type in ENDO_COLUMN_DEFS:
        if name not in existing_columns:
            if "PRIMARY KEY" in col_type.upper():
                continue
            conn.execute(f'ALTER TABLE "{target_table}" ADD COLUMN "{name}" {col_type}')

    conn.commit()


def upsert_endo_metrics(conn: sqlite3.Connection, df: pd.DataFrame, target_table: str = "endo_metrics") -> None:
    ensure_endo_metrics_table(conn=conn, target_table=target_table)

    working = df.copy()

    for col in ENDO_METRICS_COLUMNS:
        if col not in working.columns:
            working[col] = None

    working = working[ENDO_METRICS_COLUMNS].copy()
    working["exam_date"] = pd.to_datetime(working["exam_date"], errors="coerce").dt.strftime("%Y-%m-%d")
    working = working[working["exam_date"].notna()].copy()

    quoted_cols = [f'"{c}"' for c in ENDO_METRICS_COLUMNS]
    placeholders = ", ".join(["?"] * len(ENDO_METRICS_COLUMNS))
    update_assignments = ", ".join(
        [f'"{c}" = excluded."{c}"' for c in ENDO_METRICS_COLUMNS if c != "exam_date"]
    )

    sql = f"""
    INSERT INTO "{target_table}" ({", ".join(quoted_cols)})
    VALUES ({placeholders})
    ON CONFLICT("exam_date") DO UPDATE SET
    {update_assignments}
    """

    rows = []
    for record in working.to_dict(orient="records"):
        rows.append(tuple(_sanitize_value(record.get(col)) for col in ENDO_METRICS_COLUMNS))

    conn.executemany(sql, rows)
    conn.commit()