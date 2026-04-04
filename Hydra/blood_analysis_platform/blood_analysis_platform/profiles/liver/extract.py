from __future__ import annotations

import sqlite3
from typing import Dict

import pandas as pd


DEFAULT_COLUMN_MAP = {
    "ast": "AST",
    "alt": "ALT",
    "ggt": "GGT",
    "alp": "ALP",
    "total_bilirubin": "Total Bilirubin",
    "direct_bilirubin": "Direct Bilirubin",
    "albumin": "Albumin",
    "ldh": "LDH",
}


def _quote_identifier(name: str) -> str:
    return f'"{name}"'


def load_liver_raw(
    conn: sqlite3.Connection,
    source_table: str = "liver_raw",
    profile_config: Dict | None = None,
) -> pd.DataFrame:
    profile_config = profile_config or {}
    date_column = profile_config.get("date_column", "Exam Date")
    configured_columns = profile_config.get("columns", {})

    column_map = DEFAULT_COLUMN_MAP.copy()
    column_map.update(configured_columns)

    select_parts = [f'{_quote_identifier(date_column)} AS "exam_date"']
    for normalized_name, raw_name in column_map.items():
        select_parts.append(f'{_quote_identifier(raw_name)} AS "{normalized_name}"')

    sql = f'''
    SELECT
        {", ".join(select_parts)}
    FROM "{source_table}"
    ORDER BY "{date_column}"
    '''

    df = pd.read_sql_query(sql, conn)
    df["exam_date"] = pd.to_datetime(df["exam_date"], errors="coerce")
    return df.sort_values("exam_date").reset_index(drop=True)