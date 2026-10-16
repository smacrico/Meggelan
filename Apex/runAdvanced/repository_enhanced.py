from __future__ import annotations

import logging
import sqlite3
from datetime import datetime
from typing import Any

import pandas as pd


class RunningRepository:
    """
    SQLite repository for the enhanced running analytics pipeline.

    It supports both legacy raw column names:
      - HR_RS_Deviation_Index
      - cardiacdrift

    and enhanced normalized names:
      - hr_rs_deviation
      - cardiac_drift
    """

    RAW_TABLE_CANDIDATES = ("adv_running_sessions", "adv_sessions", "running_sessions")
    TRAINING_LOG_TABLE = "adv_training_log"
    MONTHLY_TABLE = "adv_monthly_summaries"
    BREAKDOWN_TABLE = "adv_metrics_breakdown"

    MONTHLY_METRICS = [
        "running_economy",
        "vo2max",
        "distance",
        "efficiency_score",
        "heart_rate",
        "energy_cost",
        "TRIMP",
        "acute_load_7d",
        "chronic_load_28d",
        "acwr_7_28",
        "weekly_monotony",
        "weekly_strain",
        "recovery_score",
        "readiness_score",
        "avg_speed",
        "max_speed",
        "speed_reserve",
        "hr_rs_deviation",
        "speed_efficiency",
        "efficiency_factor",
        "performance_index",
        "aerobic_decoupling_pct",
        "pace_per_km",
        "economy_at_speed",
        "physio_efficiency",
        "fatigue_index",
    ]

    BREAKDOWN_COLUMNS = [
        "calculation_date",
        "overall_score",
        "running_economy_normalized",
        "running_economy_weighted",
        "running_economy_raw_mean",
        "running_economy_raw_std",
        "vo2max_normalized",
        "vo2max_weighted",
        "vo2max_raw_mean",
        "vo2max_raw_std",
        "distance_normalized",
        "distance_weighted",
        "distance_raw_mean",
        "distance_raw_std",
        "efficiency_score_normalized",
        "efficiency_score_weighted",
        "efficiency_score_raw_mean",
        "efficiency_score_raw_std",
        "heart_rate_normalized",
        "heart_rate_weighted",
        "heart_rate_raw_mean",
        "heart_rate_raw_std",
        "running_economy_trend",
        "distance_progression",
        "avg_speed_mean",
        "avg_speed_std",
        "max_speed_mean",
        "max_speed_std",
        "speed_reserve_mean",
        "speed_reserve_std",
        "speed_consistency_mean",
        "speed_consistency_std",
        "pace_per_km_mean",
        "pace_per_km_std",
        "speed_efficiency_mean",
        "speed_efficiency_std",
        "economy_at_speed_mean",
        "economy_at_speed_std",
        "speed_vo2max_index_mean",
        "speed_vo2max_index_std",
        "hr_rs_deviation_mean",
        "hr_rs_deviation_std",
        "cardiac_drift_mean",
        "cardiac_drift_std",
        "physio_efficiency_mean",
        "physio_efficiency_std",
        "fatigue_index_mean",
        "fatigue_index_std",
        "efficiency_factor_mean",
        "efficiency_factor_std",
        "performance_index_mean",
        "performance_index_std",
        "aerobic_decoupling_pct_mean",
        "aerobic_decoupling_pct_std",
        "acwr_7_28_mean",
        "acwr_7_28_std",
        "weekly_monotony_mean",
        "weekly_monotony_std",
        "weekly_strain_mean",
        "weekly_strain_std",
    ]

    def __init__(self, db_path: str, raw_table: str | None = None) -> None:
        self.db_path = db_path
        self.raw_table = raw_table

    def connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _table_exists(self, conn: sqlite3.Connection, table_name: str) -> bool:
        row = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
        ).fetchone()
        return row is not None

    def _columns(self, conn: sqlite3.Connection, table_name: str) -> set[str]:
        return {row[1] for row in conn.execute(f'PRAGMA table_info("{table_name}")')}

    def _source_table(self, conn: sqlite3.Connection) -> str:
        """
        Pick the raw table that actually contains sessions.

        Older versions sometimes left an empty `running_sessions` table in the
        database. The previous logic picked the first existing table, so the app
        loaded 0 rows even when `adv_running_sessions` / `adv_sessions` had data.
        """
        if self.raw_table:
            if not self._table_exists(conn, self.raw_table):
                raise RuntimeError(f"Raw table '{self.raw_table}' does not exist.")
            return self.raw_table

        existing: list[str] = []
        for candidate in self.RAW_TABLE_CANDIDATES:
            if self._table_exists(conn, candidate):
                existing.append(candidate)
                try:
                    row_count = conn.execute(f'SELECT COUNT(*) FROM "{candidate}"').fetchone()[0]
                except sqlite3.Error:
                    row_count = 0
                if row_count > 0:
                    logging.info("Using raw sessions table: %s (%s rows)", candidate, row_count)
                    return candidate

        if existing:
            logging.warning(
                "Raw session tables exist but are empty: %s",
                ", ".join(existing),
            )
            return existing[0]

        raise RuntimeError(
            "No raw running sessions table found. Expected one of: "
            + ", ".join(self.RAW_TABLE_CANDIDATES)
        )

    @staticmethod
    def _coalesce_expr(columns: set[str], aliases: list[str], alias: str, default: str = "0") -> str:
        available = [f'"{col}"' for col in aliases if col in columns]
        if not available:
            return f"{default} AS {alias}"
        return f"COALESCE({', '.join(available)}, {default}) AS {alias}"

    def load_running_sessions(self) -> pd.DataFrame:
        with self.connect() as conn:
            table = self._source_table(conn)
            columns = self._columns(conn, table)

            select_parts = [
                self._coalesce_expr(columns, ["activity_id", "id", "rowid"], "activity_id", "NULL"),
                self._coalesce_expr(columns, ["date", "timestamp"], "date", "NULL"),
                self._coalesce_expr(columns, ["running_economy"], "running_economy"),
                self._coalesce_expr(columns, ["vo2max"], "vo2max"),
                self._coalesce_expr(columns, ["distance"], "distance"),
                self._coalesce_expr(columns, ["time"], "time"),
                self._coalesce_expr(columns, ["heart_rate"], "heart_rate"),
                self._coalesce_expr(columns, ["avg_speed"], "avg_speed"),
                self._coalesce_expr(columns, ["max_speed"], "max_speed"),
                self._coalesce_expr(columns, ["hr_rs_deviation", "HR_RS_Deviation_Index"], "hr_rs_deviation"),
                self._coalesce_expr(columns, ["cardiac_drift", "cardiacdrift"], "cardiac_drift"),
                self._coalesce_expr(columns, ["resting_hr"], "resting_hr", "NULL"),
                self._coalesce_expr(columns, ["sleep_quality"], "sleep_quality", "NULL"),
                self._coalesce_expr(columns, ["fatigue_level"], "fatigue_level", "NULL"),
                self._coalesce_expr(columns, ["first_half_hr"], "first_half_hr", "NULL"),
                self._coalesce_expr(columns, ["second_half_hr"], "second_half_hr", "NULL"),
                self._coalesce_expr(columns, ["first_half_speed"], "first_half_speed", "NULL"),
                self._coalesce_expr(columns, ["second_half_speed"], "second_half_speed", "NULL"),
            ]

            query = f'SELECT {", ".join(select_parts)} FROM "{table}"'
            raw_df = pd.read_sql_query(query, conn)

        if raw_df.empty:
            logging.warning("No running sessions found.")
            return pd.DataFrame()

        raw_df["date_raw"] = raw_df["date"]
        raw_df["date"] = pd.to_datetime(raw_df["date"], errors="coerce")

        invalid_dates = raw_df["date"].isna().sum()
        if invalid_dates:
            logging.warning("Invalid dates dropped: %s", invalid_dates)

        df = raw_df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
        logging.info("Rows returned to app: %s", len(df))
        return df.drop(columns=["date_raw"])

    def add_session(
        self,
        date: str,
        running_economy: float,
        vo2max: float,
        distance: float,
        time: float,
        heart_rate: float,
        avg_speed: float | None = None,
        max_speed: float | None = None,
        hr_rs_deviation: float | None = None,
        cardiac_drift: float | None = None,
        resting_hr: float | None = None,
        sleep_quality: float | None = None,
        fatigue_level: float | None = None,
        first_half_hr: float | None = None,
        second_half_hr: float | None = None,
        first_half_speed: float | None = None,
        second_half_speed: float | None = None,
        sport: str | None = None,
        cardiacdrift: float | None = None,
    ) -> None:
        with self.connect() as conn:
            table = self._source_table(conn)
            columns = self._columns(conn, table)

            values: dict[str, Any] = {
                "date": date,
                "running_economy": running_economy,
                "vo2max": vo2max,
                "distance": distance,
                "time": time,
                "heart_rate": heart_rate,
                "avg_speed": avg_speed,
                "max_speed": max_speed,
                "hr_rs_deviation": hr_rs_deviation,
                "HR_RS_Deviation_Index": hr_rs_deviation,
                "cardiac_drift": cardiac_drift if cardiac_drift is not None else cardiacdrift,
                "cardiacdrift": cardiac_drift if cardiac_drift is not None else cardiacdrift,
                "resting_hr": resting_hr,
                "sleep_quality": sleep_quality,
                "fatigue_level": fatigue_level,
                "first_half_hr": first_half_hr,
                "second_half_hr": second_half_hr,
                "first_half_speed": first_half_speed,
                "second_half_speed": second_half_speed,
                "sport": sport,
            }
            insert_cols = [col for col in values if col in columns]
            placeholders = ", ".join(["?"] * len(insert_cols))
            sql = f'INSERT INTO "{table}" ({", ".join(insert_cols)}) VALUES ({placeholders})'
            conn.execute(sql, tuple(values[col] for col in insert_cols))
            conn.commit()

    @staticmethod
    def _prepare_for_sql(df: pd.DataFrame) -> pd.DataFrame:
        out = df.copy()

        for col in out.columns:
            if pd.api.types.is_datetime64_any_dtype(out[col]):
                out[col] = out[col].dt.strftime("%Y-%m-%d %H:%M:%S")
            elif isinstance(out[col].dtype, pd.PeriodDtype):
                out[col] = out[col].astype(str)
            elif str(out[col].dtype) == "category":
                out[col] = out[col].astype(str)
            elif pd.api.types.is_bool_dtype(out[col]):
                out[col] = out[col].astype(int)

        return out.replace({pd.NA: None})

    def save_training_log(self, df: pd.DataFrame, table_name: str = TRAINING_LOG_TABLE) -> None:
        with self.connect() as conn:
            self._prepare_for_sql(df).to_sql(table_name, conn, if_exists="replace", index=False)

    def create_monthly_summaries_table(self, table_name: str = MONTHLY_TABLE) -> None:
        stat_cols = []
        for metric in self.MONTHLY_METRICS:
            stat_cols.extend([
                f"{metric}_mean REAL",
                f"{metric}_std REAL",
                f"{metric}_count INTEGER",
            ])

        sql = f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            year_month TEXT PRIMARY KEY,
            session_count INTEGER,
            {", ".join(stat_cols)}
        )
        """

        with self.connect() as conn:
            conn.execute(sql)
            conn.commit()

    def upsert_monthly_summaries(
        self,
        monthly_avg: pd.DataFrame,
        monthly_sessions: dict,
        table_name: str = MONTHLY_TABLE,
    ) -> None:
        if monthly_avg is None or monthly_avg.empty:
            return

        self.create_monthly_summaries_table(table_name)

        def get_val(month_key, metric: str, stat: str) -> float | int | None:
            if metric not in monthly_avg.columns.get_level_values(0):
                return None
            val = monthly_avg.loc[month_key, (metric, stat)]
            if pd.isna(val):
                return None
            return int(val) if stat == "count" else float(val)

        metric_cols = [
            f"{metric}_{stat}"
            for metric in self.MONTHLY_METRICS
            for stat in ("mean", "std", "count")
        ]
        columns = ["year_month", "session_count", *metric_cols]
        placeholders = ", ".join(["?"] * len(columns))
        update_set = ", ".join([f"{col}=excluded.{col}" for col in columns if col != "year_month"])

        with self.connect() as conn:
            for year_month in monthly_avg.index:
                values = [
                    str(year_month),
                    int(monthly_sessions.get(year_month, 0)),
                    *[
                        get_val(year_month, metric, stat)
                        for metric in self.MONTHLY_METRICS
                        for stat in ("mean", "std", "count")
                    ],
                ]

                conn.execute(
                    f"""
                    INSERT INTO {table_name} ({", ".join(columns)})
                    VALUES ({placeholders})
                    ON CONFLICT(year_month) DO UPDATE SET {update_set}
                    """,
                    values,
                )

            conn.commit()

    def create_metrics_breakdown_table(self, table_name: str = BREAKDOWN_TABLE) -> None:
        cols_sql = ["id INTEGER PRIMARY KEY AUTOINCREMENT"]
        for col in self.BREAKDOWN_COLUMNS:
            if col == "calculation_date":
                cols_sql.append(f"{col} TEXT")
            else:
                cols_sql.append(f"{col} REAL")

        with self.connect() as conn:
            conn.execute(f"CREATE TABLE IF NOT EXISTS {table_name} ({', '.join(cols_sql)})")
            conn.commit()

    def insert_metrics_breakdown(self, values_to_insert: tuple, table_name: str = BREAKDOWN_TABLE) -> None:
        if len(values_to_insert) != len(self.BREAKDOWN_COLUMNS):
            raise ValueError(
                f"Expected {len(self.BREAKDOWN_COLUMNS)} metrics breakdown values, "
                f"got {len(values_to_insert)}."
            )

        self.create_metrics_breakdown_table(table_name)
        placeholders = ", ".join(["?"] * len(self.BREAKDOWN_COLUMNS))
        columns = ", ".join(self.BREAKDOWN_COLUMNS)

        with self.connect() as conn:
            conn.execute(
                f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})",
                values_to_insert,
            )
            conn.commit()

    @staticmethod
    def today_string() -> str:
        return datetime.now().strftime("%Y-%m-%d")
