from __future__ import annotations

import logging
import sqlite3
from datetime import datetime

import pandas as pd


class RunningRepository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    def connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def load_running_sessions(self) -> pd.DataFrame:
        query = """
        SELECT
            rowid,
            date,
            COALESCE(running_economy, 0) AS running_economy,
            COALESCE(vo2max, 0) AS vo2max,
            COALESCE(distance, 0) AS distance,
            COALESCE(time, 0) AS time,
            COALESCE(heart_rate, 0) AS heart_rate,
            COALESCE(avg_speed, 0) AS avg_speed,
            COALESCE(max_speed, 0) AS max_speed,
            COALESCE(HR_RS_Deviation_Index, 0) AS hr_rs_deviation,
            COALESCE(cardiacdrift, 0) AS cardiac_drift
        FROM running_sessions
        """

        with self.connect() as conn:
            raw_df = pd.read_sql_query(query, conn)

        if raw_df.empty:
            logging.warning("No running sessions found.")
            return pd.DataFrame()

        logging.info("Rows read from DB: %s", len(raw_df))

        raw_df["date_raw"] = raw_df["date"]
        raw_df["date"] = pd.to_datetime(raw_df["date"], errors="coerce")

        invalid_dates = raw_df["date"].isna().sum()
        if invalid_dates > 0:
            logging.warning("Invalid dates dropped: %s", invalid_dates)
            bad_rows = raw_df[raw_df["date"].isna()][["rowid", "date_raw"]]
            logging.warning("Rows with invalid date values:\n%s", bad_rows.to_string(index=False))

        df = raw_df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
        logging.info("Rows returned to app: %s", len(df))

        # Keep original source date string only for debugging if needed
        return df.drop(columns=["date_raw"])

    def add_session(
        self,
        date: str,
        running_economy: float,
        vo2max: float,
        distance: float,
        time: float,
        heart_rate: float,
        sport: str | None = None,
        cardiacdrift: float | None = None,
    ) -> None:
        with self.connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO running_sessions
                (date, running_economy, vo2max, distance, time, heart_rate, sport, cardiacdrift)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    date,
                    running_economy,
                    vo2max,
                    distance,
                    time,
                    heart_rate,
                    sport,
                    cardiacdrift,
                ),
            )
            conn.commit()

    def save_training_log(self, df: pd.DataFrame, table_name: str = "training_logs") -> None:
        with self.connect() as conn:
            df.to_sql(table_name, conn, if_exists="replace", index=False)

    def create_monthly_summaries_table(self) -> None:
        with self.connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS monthly_summaries (
                    year_month TEXT PRIMARY KEY,
                    sessions INTEGER,
                    running_economy_mean REAL,
                    running_economy_std REAL,
                    vo2max_mean REAL,
                    vo2max_std REAL,
                    distance_mean REAL,
                    distance_std REAL,
                    efficiency_score_mean REAL,
                    efficiency_score_std REAL,
                    heart_rate_mean REAL,
                    heart_rate_std REAL,
                    energy_cost_mean REAL,
                    energy_cost_std REAL,
                    trimp_mean REAL,
                    trimp_std REAL,
                    recovery_score_mean REAL,
                    recovery_score_std REAL,
                    readiness_score_mean REAL,
                    readiness_score_std REAL,
                    avg_speed_mean REAL,
                    avg_speed_std REAL,
                    max_speed_mean REAL,
                    max_speed_std REAL,
                    speed_reserve_mean REAL,
                    speed_reserve_std REAL,
                    hr_rs_deviation_mean REAL,
                    hr_rs_deviation_std REAL,
                    speed_efficiency_mean REAL,
                    speed_efficiency_std REAL
                )
                """
            )
            conn.commit()

    def upsert_monthly_summaries(
        self,
        monthly_avg: pd.DataFrame,
        monthly_sessions: dict,
    ) -> None:
        def get_val(month_key, metric: str, stat: str) -> float | None:
            if metric in monthly_avg.columns.get_level_values(0):
                val = monthly_avg.loc[month_key, (metric, stat)]
                return None if pd.isna(val) else float(val)
            return None

        with self.connect() as conn:
            cursor = conn.cursor()

            for year_month in monthly_avg.index:
                sessions = int(monthly_sessions.get(year_month, 0))

                cursor.execute(
                    """
                    INSERT INTO monthly_summaries (
                        year_month,
                        sessions,
                        running_economy_mean, running_economy_std,
                        vo2max_mean, vo2max_std,
                        distance_mean, distance_std,
                        efficiency_score_mean, efficiency_score_std,
                        heart_rate_mean, heart_rate_std,
                        energy_cost_mean, energy_cost_std,
                        trimp_mean, trimp_std,
                        recovery_score_mean, recovery_score_std,
                        readiness_score_mean, readiness_score_std,
                        avg_speed_mean, avg_speed_std,
                        max_speed_mean, max_speed_std,
                        speed_reserve_mean, speed_reserve_std,
                        hr_rs_deviation_mean, hr_rs_deviation_std,
                        speed_efficiency_mean, speed_efficiency_std
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(year_month) DO UPDATE SET
                        sessions=excluded.sessions,
                        running_economy_mean=excluded.running_economy_mean,
                        running_economy_std=excluded.running_economy_std,
                        vo2max_mean=excluded.vo2max_mean,
                        vo2max_std=excluded.vo2max_std,
                        distance_mean=excluded.distance_mean,
                        distance_std=excluded.distance_std,
                        efficiency_score_mean=excluded.efficiency_score_mean,
                        efficiency_score_std=excluded.efficiency_score_std,
                        heart_rate_mean=excluded.heart_rate_mean,
                        heart_rate_std=excluded.heart_rate_std,
                        energy_cost_mean=excluded.energy_cost_mean,
                        energy_cost_std=excluded.energy_cost_std,
                        trimp_mean=excluded.trimp_mean,
                        trimp_std=excluded.trimp_std,
                        recovery_score_mean=excluded.recovery_score_mean,
                        recovery_score_std=excluded.recovery_score_std,
                        readiness_score_mean=excluded.readiness_score_mean,
                        readiness_score_std=excluded.readiness_score_std,
                        avg_speed_mean=excluded.avg_speed_mean,
                        avg_speed_std=excluded.avg_speed_std,
                        max_speed_mean=excluded.max_speed_mean,
                        max_speed_std=excluded.max_speed_std,
                        speed_reserve_mean=excluded.speed_reserve_mean,
                        speed_reserve_std=excluded.speed_reserve_std,
                        hr_rs_deviation_mean=excluded.hr_rs_deviation_mean,
                        hr_rs_deviation_std=excluded.hr_rs_deviation_std,
                        speed_efficiency_mean=excluded.speed_efficiency_mean,
                        speed_efficiency_std=excluded.speed_efficiency_std
                    """,
                    (
                        str(year_month),
                        sessions,
                        get_val(year_month, "running_economy", "mean"),
                        get_val(year_month, "running_economy", "std"),
                        get_val(year_month, "vo2max", "mean"),
                        get_val(year_month, "vo2max", "std"),
                        get_val(year_month, "distance", "mean"),
                        get_val(year_month, "distance", "std"),
                        get_val(year_month, "efficiency_score", "mean"),
                        get_val(year_month, "efficiency_score", "std"),
                        get_val(year_month, "heart_rate", "mean"),
                        get_val(year_month, "heart_rate", "std"),
                        get_val(year_month, "energy_cost", "mean"),
                        get_val(year_month, "energy_cost", "std"),
                        get_val(year_month, "TRIMP", "mean"),
                        get_val(year_month, "TRIMP", "std"),
                        get_val(year_month, "recovery_score", "mean"),
                        get_val(year_month, "recovery_score", "std"),
                        get_val(year_month, "readiness_score", "mean"),
                        get_val(year_month, "readiness_score", "std"),
                        get_val(year_month, "avg_speed", "mean"),
                        get_val(year_month, "avg_speed", "std"),
                        get_val(year_month, "max_speed", "mean"),
                        get_val(year_month, "max_speed", "std"),
                        get_val(year_month, "speed_reserve", "mean"),
                        get_val(year_month, "speed_reserve", "std"),
                        get_val(year_month, "hr_rs_deviation", "mean"),
                        get_val(year_month, "hr_rs_deviation", "std"),
                        get_val(year_month, "speed_efficiency", "mean"),
                        get_val(year_month, "speed_efficiency", "std"),
                    ),
                )

            conn.commit()

    def create_metrics_breakdown_table(self) -> None:
        with self.connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS metrics_breakdown (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT,
                    overall_score REAL,
                    running_economy_normalized REAL,
                    running_economy_weighted REAL,
                    running_economy_raw_mean REAL,
                    running_economy_raw_std REAL,
                    vo2max_normalized REAL,
                    vo2max_weighted REAL,
                    vo2max_raw_mean REAL,
                    vo2max_raw_std REAL,
                    distance_normalized REAL,
                    distance_weighted REAL,
                    distance_raw_mean REAL,
                    distance_raw_std REAL,
                    efficiency_score_normalized REAL,
                    efficiency_score_weighted REAL,
                    efficiency_score_raw_mean REAL,
                    efficiency_score_raw_std REAL,
                    heart_rate_normalized REAL,
                    heart_rate_weighted REAL,
                    heart_rate_raw_mean REAL,
                    heart_rate_raw_std REAL,
                    running_economy_trend REAL,
                    distance_progression REAL,
                    avg_speed_mean REAL,
                    avg_speed_std REAL,
                    max_speed_mean REAL,
                    max_speed_std REAL,
                    speed_reserve_mean REAL,
                    speed_reserve_std REAL,
                    speed_consistency_mean REAL,
                    speed_consistency_std REAL,
                    pace_per_km_mean REAL,
                    pace_per_km_std REAL,
                    speed_efficiency_mean REAL,
                    speed_efficiency_std REAL,
                    economy_at_speed_mean REAL,
                    economy_at_speed_std REAL,
                    speed_vo2max_index_mean REAL,
                    speed_vo2max_index_std REAL,
                    hr_rs_deviation_mean REAL,
                    hr_rs_deviation_std REAL,
                    cardiac_drift_mean REAL,
                    cardiac_drift_std REAL,
                    physio_efficiency_mean REAL,
                    physio_efficiency_std REAL,
                    fatigue_index_mean REAL,
                    fatigue_index_std REAL
                )
                """
            )
            conn.commit()

    def insert_metrics_breakdown(self, values_to_insert: tuple) -> None:
        with self.connect() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO metrics_breakdown (
                    date,
                    overall_score,
                    running_economy_normalized,
                    running_economy_weighted,
                    running_economy_raw_mean,
                    running_economy_raw_std,
                    vo2max_normalized,
                    vo2max_weighted,
                    vo2max_raw_mean,
                    vo2max_raw_std,
                    distance_normalized,
                    distance_weighted,
                    distance_raw_mean,
                    distance_raw_std,
                    efficiency_score_normalized,
                    efficiency_score_weighted,
                    efficiency_score_raw_mean,
                    efficiency_score_raw_std,
                    heart_rate_normalized,
                    heart_rate_weighted,
                    heart_rate_raw_mean,
                    heart_rate_raw_std,
                    running_economy_trend,
                    distance_progression,
                    avg_speed_mean,
                    avg_speed_std,
                    max_speed_mean,
                    max_speed_std,
                    speed_reserve_mean,
                    speed_reserve_std,
                    speed_consistency_mean,
                    speed_consistency_std,
                    pace_per_km_mean,
                    pace_per_km_std,
                    speed_efficiency_mean,
                    speed_efficiency_std,
                    economy_at_speed_mean,
                    economy_at_speed_std,
                    speed_vo2max_index_mean,
                    speed_vo2max_index_std,
                    hr_rs_deviation_mean,
                    hr_rs_deviation_std,
                    cardiac_drift_mean,
                    cardiac_drift_std,
                    physio_efficiency_mean,
                    physio_efficiency_std,
                    fatigue_index_mean,
                    fatigue_index_std
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?
                )
                """,
                values_to_insert,
            )
            conn.commit()

    @staticmethod
    def today_string() -> str:
        return datetime.now().strftime("%Y-%m-%d")