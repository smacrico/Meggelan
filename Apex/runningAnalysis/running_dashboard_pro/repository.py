
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
            df = pd.read_sql_query(query, conn)

        if df.empty:
            logging.warning("No running sessions found.")
            return pd.DataFrame()

        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.dropna(subset=["date"]).sort_values("date").reset_index(drop=True)
        return df

    def save_training_log(self, df: pd.DataFrame, table_name: str = "training_logs") -> None:
        with self.connect() as conn:
            df.to_sql(table_name, conn, if_exists="replace", index=False)

    @staticmethod
    def today_string() -> str:
        return datetime.now().strftime("%Y-%m-%d")
