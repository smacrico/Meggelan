
from __future__ import annotations

import argparse
import sqlite3

import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser(description="Load lipid CSV into SQLite lipid_raw table")
    parser.add_argument("--sqlite", required=True, help="Path to SQLite database")
    parser.add_argument("--csv", required=True, help="Path to source CSV")
    parser.add_argument("--table", default="lipid_raw", help="Target raw table name")
    args = parser.parse_args()

    df = pd.read_csv(args.csv)
    with sqlite3.connect(args.sqlite) as conn:
        df.to_sql(args.table, conn, if_exists="replace", index=False)
    print(f"Loaded {len(df)} rows into {args.table}")


if __name__ == "__main__":
    main()
