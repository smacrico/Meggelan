from __future__ import annotations

import sqlite3

import numpy as np
import pandas as pd


LIVER_COLUMN_DEFS = [
    ("exam_date", "TEXT PRIMARY KEY"),
    ("ast", "REAL NULL"),
    ("alt", "REAL NULL"),
    ("ggt", "REAL NULL"),
    ("alp", "REAL NULL"),
    ("total_bilirubin", "REAL NULL"),
    ("direct_bilirubin", "REAL NULL"),
    ("albumin", "REAL NULL"),
    ("ldh", "REAL NULL"),
    ("ast_alt_ratio", "REAL NULL"),
    ("indirect_bilirubin", "REAL NULL"),
    ("direct_total_bilirubin_pct", "REAL NULL"),
    ("ast_alt_pattern", "TEXT NULL"),
    ("direct_total_bilirubin_risk", "TEXT NULL"),
    ("bilirubin_pattern", "TEXT NULL"),
    ("ast_prev", "REAL NULL"),
    ("ast_delta", "REAL NULL"),
    ("ast_pct_change", "REAL NULL"),
    ("ast_rolling3", "REAL NULL"),
    ("alt_prev", "REAL NULL"),
    ("alt_delta", "REAL NULL"),
    ("alt_pct_change", "REAL NULL"),
    ("alt_rolling3", "REAL NULL"),
    ("ggt_prev", "REAL NULL"),
    ("ggt_delta", "REAL NULL"),
    ("ggt_pct_change", "REAL NULL"),
    ("ggt_rolling3", "REAL NULL"),
    ("alp_prev", "REAL NULL"),
    ("alp_delta", "REAL NULL"),
    ("alp_pct_change", "REAL NULL"),
    ("alp_rolling3", "REAL NULL"),
    ("total_bilirubin_prev", "REAL NULL"),
    ("total_bilirubin_delta", "REAL NULL"),
    ("total_bilirubin_pct_change", "REAL NULL"),
    ("total_bilirubin_rolling3", "REAL NULL"),
    ("direct_bilirubin_prev", "REAL NULL"),
    ("direct_bilirubin_delta", "REAL NULL"),
    ("direct_bilirubin_pct_change", "REAL NULL"),
    ("direct_bilirubin_rolling3", "REAL NULL"),
    ("albumin_prev", "REAL NULL"),
    ("albumin_delta", "REAL NULL"),
    ("albumin_pct_change", "REAL NULL"),
    ("albumin_rolling3", "REAL NULL"),
    ("ldh_prev", "REAL NULL"),
    ("ldh_delta", "REAL NULL"),
    ("ldh_pct_change", "REAL NULL"),
    ("ldh_rolling3", "REAL NULL"),
    ("ast_alt_ratio_prev", "REAL NULL"),
    ("ast_alt_ratio_delta", "REAL NULL"),
    ("ast_alt_ratio_pct_change", "REAL NULL"),
    ("ast_alt_ratio_rolling3", "REAL NULL"),
    ("indirect_bilirubin_prev", "REAL NULL"),
    ("indirect_bilirubin_delta", "REAL NULL"),
    ("indirect_bilirubin_pct_change", "REAL NULL"),
    ("indirect_bilirubin_rolling3", "REAL NULL"),
    ("direct_total_bilirubin_pct_prev", "REAL NULL"),
    ("direct_total_bilirubin_pct_delta", "REAL NULL"),
    ("direct_total_bilirubin_pct_pct_change", "REAL NULL"),
    ("direct_total_bilirubin_pct_rolling3", "REAL NULL"),
    ("has_core_liver", "INTEGER NOT NULL DEFAULT 0"),
    ("is_complete_profile", "INTEGER NOT NULL DEFAULT 0"),
    ("record_quality_note", "TEXT NULL"),
]

LIVER_METRICS_COLUMNS = [name for name, _ in LIVER_COLUMN_DEFS]


def _sanitize_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, np.generic):
        return value.item()
    return value


def _get_existing_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    return {row[1] for row in rows}


def ensure_liver_metrics_table(conn: sqlite3.Connection, target_table: str = "liver_metrics") -> None:
    create_cols = ",\n        ".join([f'"{name}" {col_type}' for name, col_type in LIVER_COLUMN_DEFS])

    ddl = f"""
    CREATE TABLE IF NOT EXISTS "{target_table}" (
        {create_cols}
    );
    """
    conn.execute(ddl)

    existing_columns = _get_existing_columns(conn, target_table)

    for name, col_type in LIVER_COLUMN_DEFS:
        if name not in existing_columns:
            if "PRIMARY KEY" in col_type.upper():
                continue
            conn.execute(f'ALTER TABLE "{target_table}" ADD COLUMN "{name}" {col_type}')

    conn.commit()


def upsert_liver_metrics(conn: sqlite3.Connection, df: pd.DataFrame, target_table: str = "liver_metrics") -> None:
    ensure_liver_metrics_table(conn=conn, target_table=target_table)

    working = df.copy()

    for col in LIVER_METRICS_COLUMNS:
        if col not in working.columns:
            working[col] = None

    working = working[LIVER_METRICS_COLUMNS].copy()
    working["exam_date"] = pd.to_datetime(working["exam_date"], errors="coerce").dt.strftime("%Y-%m-%d")
    working = working[working["exam_date"].notna()].copy()

    quoted_cols = [f'"{c}"' for c in LIVER_METRICS_COLUMNS]
    placeholders = ", ".join(["?"] * len(LIVER_METRICS_COLUMNS))
    update_assignments = ", ".join(
        [f'"{c}" = excluded."{c}"' for c in LIVER_METRICS_COLUMNS if c != "exam_date"]
    )

    sql = f"""
    INSERT INTO "{target_table}" ({", ".join(quoted_cols)})
    VALUES ({placeholders})
    ON CONFLICT("exam_date") DO UPDATE SET
    {update_assignments}
    """

    rows = []
    for record in working.to_dict(orient="records"):
        rows.append(tuple(_sanitize_value(record.get(col)) for col in LIVER_METRICS_COLUMNS))

    conn.executemany(sql, rows)
    conn.commit()