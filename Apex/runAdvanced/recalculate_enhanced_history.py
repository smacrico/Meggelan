from __future__ import annotations

import argparse
import importlib
import sqlite3
from pathlib import Path

import pandas as pd


def read_snapshot_dates(csv_path: str) -> list[pd.Timestamp]:
    """
    Reads dates from the first column of an old metrics_breakdown/brakedown CSV.

    The old export may have no header. Reading with header=None preserves the first
    date row instead of treating it as a column name.
    """
    old = pd.read_csv(csv_path, header=None)
    if old.empty:
        return []

    dates = pd.to_datetime(old.iloc[:, 0], errors="coerce").dropna()
    return sorted(dates.dt.normalize().drop_duplicates().tolist())


def existing_tables(db_path: str) -> set[str]:
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    return {r[0] for r in rows}


def recreate_output_table(db_path: str, table_name: str, columns: list[str]) -> None:
    col_defs = ["id INTEGER PRIMARY KEY AUTOINCREMENT"]
    for col in columns:
        col_defs.append(f"{col} TEXT" if col == "calculation_date" else f"{col} REAL")

    with sqlite3.connect(db_path) as conn:
        conn.execute(f'DROP TABLE IF EXISTS "{table_name}"')
        conn.execute(f'CREATE TABLE "{table_name}" ({", ".join(col_defs)})')
        conn.commit()


def insert_row(db_path: str, table_name: str, columns: list[str], row: tuple) -> None:
    placeholders = ", ".join(["?"] * len(columns))
    quoted_cols = ", ".join([f'"{c}"' for c in columns])
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            f'INSERT INTO "{table_name}" ({quoted_cols}) VALUES ({placeholders})',
            row,
        )
        conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Recalculate enhanced historical metrics_breakdown rows for dates found in an old CSV."
    )
    parser.add_argument("--db", required=True, help="SQLite database path")
    parser.add_argument("--csv", required=True, help="Old metrics_breakdown/brakedown CSV path")
    parser.add_argument(
        "--raw-table",
        default=None,
        help="Raw sessions table. If omitted, tries adv_running_sessions, adv_sessions, running_sessions.",
    )
    parser.add_argument(
        "--output-table",
        default="adv_metrics_breakdown",
        help="Output table for recalculated enhanced snapshots.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Drop/recreate output table before inserting.",
    )
    args = parser.parse_args()

    # Import local enhanced modules from the project folder.
    repository_module = importlib.import_module("repository_enhanced")
    metrics_module = importlib.import_module("metrics_enhanced")

    RunningRepository = repository_module.RunningRepository
    RunningMetricsService = metrics_module.RunningMetricsService

    tables = existing_tables(args.db)
    raw_table = args.raw_table
    if raw_table is None:
        for candidate in ("adv_running_sessions", "adv_sessions", "running_sessions"):
            if candidate in tables:
                raw_table = candidate
                break

    if raw_table is None:
        raise SystemExit("No raw sessions table found. Expected adv_running_sessions, adv_sessions, or running_sessions.")

    snapshot_dates = read_snapshot_dates(args.csv)
    if not snapshot_dates:
        raise SystemExit("No valid dates found in first CSV column.")

    repo = RunningRepository(args.db, raw_table=raw_table)
    service = RunningMetricsService(repo)

    full_df, weekly_trimp = service.load_training_log()
    if full_df.empty:
        raise SystemExit(f"No sessions loaded from {raw_table}.")

    full_df["date"] = pd.to_datetime(full_df["date"], errors="coerce")
    full_df = full_df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)

    columns = repo.BREAKDOWN_COLUMNS

    if args.replace:
        recreate_output_table(args.db, args.output_table, columns)
    else:
        repo.create_metrics_breakdown_table(args.output_table)

    written = 0
    skipped = 0

    for snapshot_date in snapshot_dates:
        # Use only sessions available as of the snapshot day, so old snapshots do not
        # accidentally use future sessions in scores, thresholds, or averages.
        cutoff = snapshot_date + pd.Timedelta(days=1)
        asof_df = full_df[full_df["date"] < cutoff].copy()

        if asof_df.empty:
            skipped += 1
            continue

        asof_weeks = weekly_trimp[
            weekly_trimp["week_label"].isin(asof_df["week_label"].dropna().unique())
        ].copy()

        # Re-run anomaly thresholds on the historical subset, not the full future dataset.
        asof_df, _ = service.detect_anomalies(asof_df, asof_weeks)

        training_score = service.calculate_training_score(asof_df)
        if not training_score:
            skipped += 1
            continue

        row = list(service.build_metrics_breakdown_row(asof_df, training_score))
        row[0] = snapshot_date.strftime("%Y-%m-%d")

        insert_row(args.db, args.output_table, columns, tuple(row))
        written += 1

    print(f"Raw table: {raw_table}")
    print(f"CSV dates found: {len(snapshot_dates)}")
    print(f"Rows written to {args.output_table}: {written}")
    print(f"Dates skipped: {skipped}")


if __name__ == "__main__":
    main()
