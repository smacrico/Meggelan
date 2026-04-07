from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from typing import Iterator

import pandas as pd


class DatabaseManager:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("PRAGMA foreign_keys = ON")
            yield conn
        finally:
            conn.close()

    def initialize_support_tables(self) -> None:
        """Create only non-hrv support tables.

        Assumes hrv_platform already created/populated:
        - hrv_measurements
        - hrv_baselines
        - hrv_trends
        - hrv_alerts
        - hrv_anomalies
        """
        with self.connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS symptom_log (
                    date TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    fatigue_level INTEGER,
                    cognitive_fog INTEGER,
                    mobility_score INTEGER,
                    pain_level INTEGER,
                    mood_score INTEGER,
                    heat_sensitivity INTEGER,
                    overall_wellbeing INTEGER,
                    notes TEXT,
                    PRIMARY KEY (date, source_name)
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS medication_log (
                    date TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    medication_name TEXT NOT NULL,
                    scheduled_dose_time TEXT NOT NULL,
                    actual_dose_time TEXT,
                    dose_taken INTEGER,
                    side_effects TEXT,
                    PRIMARY KEY (date, source_name, medication_name, scheduled_dose_time)
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS flare_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    flare_date TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    flare_severity INTEGER,
                    symptoms_affected TEXT,
                    duration_days INTEGER,
                    recovery_days INTEGER,
                    triggers_identified TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS ms_risk_predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prediction_timestamp TEXT NOT NULL,
                    prediction_date TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    overall_risk_score REAL NOT NULL,
                    hrv_component REAL NOT NULL,
                    trend_component REAL NOT NULL,
                    alert_component REAL NOT NULL,
                    anomaly_component REAL NOT NULL,
                    symptom_component REAL NOT NULL,
                    medication_component REAL NOT NULL,
                    risk_level TEXT NOT NULL,
                    recommendations TEXT NOT NULL,
                    data_quality_notes TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_symptom_log_date_source ON symptom_log(date, source_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_medication_log_date_source ON medication_log(date, source_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_flare_history_date_source ON flare_history(flare_date, source_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ms_risk_predictions_date_source ON ms_risk_predictions(prediction_date, source_name)")

            conn.commit()

    def get_measurements(self, source_name: str, days_back: int, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days_back - 1)

        query = """
            SELECT
                measurement_date,
                source_name,
                SD1,
                SD2,
                sdnn,
                rmssd,
                pNN50,
                VLF,
                LF,
                HF
            FROM hrv_measurements
            WHERE source_name = ?
              AND measurement_date >= ?
              AND measurement_date <= ?
            ORDER BY measurement_date DESC, id DESC
        """

        with self.connect() as conn:
            df = pd.read_sql_query(
                query,
                conn,
                params=(source_name, start_date.isoformat(), as_of.isoformat()),
            )

        if not df.empty:
            df["measurement_date"] = pd.to_datetime(df["measurement_date"]).dt.date

        return df

    def get_latest_baseline(self, source_name: str) -> pd.DataFrame:
        query = """
            SELECT *
            FROM hrv_baselines
            WHERE source_name = ?
            ORDER BY analysis_date DESC, id DESC
            LIMIT 1
        """
        with self.connect() as conn:
            return pd.read_sql_query(query, conn, params=(source_name,))

    def get_latest_trends(self, source_name: str) -> pd.DataFrame:
        query = """
            SELECT t.*
            FROM hrv_trends t
            JOIN (
                SELECT source_name, metric, MAX(analysis_date) AS max_analysis_date
                FROM hrv_trends
                WHERE source_name = ?
                GROUP BY source_name, metric
            ) latest
                ON t.source_name = latest.source_name
               AND t.metric = latest.metric
               AND t.analysis_date = latest.max_analysis_date
            WHERE t.source_name = ?
            ORDER BY t.metric ASC
        """
        with self.connect() as conn:
            return pd.read_sql_query(query, conn, params=(source_name, source_name))

    def get_recent_alerts(self, source_name: str, days_back: int, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days_back - 1)

        query = """
            SELECT *
            FROM hrv_alerts
            WHERE source_name = ?
              AND alert_date >= ?
              AND alert_date <= ?
            ORDER BY alert_date DESC, id DESC
        """
        with self.connect() as conn:
            df = pd.read_sql_query(
                query,
                conn,
                params=(source_name, start_date.isoformat(), as_of.isoformat()),
            )
        return df

    def get_recent_anomalies(self, source_name: str, days_back: int, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days_back - 1)

        query = """
            SELECT *
            FROM hrv_anomalies
            WHERE source_name = ?
              AND measurement_date >= ?
              AND measurement_date <= ?
            ORDER BY measurement_date DESC, id DESC
        """
        with self.connect() as conn:
            df = pd.read_sql_query(
                query,
                conn,
                params=(source_name, start_date.isoformat(), as_of.isoformat()),
            )
        return df

    def get_symptom_log(self, source_name: str, days_back: int, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days_back - 1)

        query = """
            SELECT *
            FROM symptom_log
            WHERE source_name = ?
              AND date >= ?
              AND date <= ?
            ORDER BY date DESC
        """
        with self.connect() as conn:
            df = pd.read_sql_query(
                query,
                conn,
                params=(source_name, start_date.isoformat(), as_of.isoformat()),
            )
        if not df.empty:
            df["date"] = pd.to_datetime(df["date"]).dt.date
        return df

    def get_medication_log(self, source_name: str, days_back: int, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days_back - 1)

        query = """
            SELECT *
            FROM medication_log
            WHERE source_name = ?
              AND date >= ?
              AND date <= ?
            ORDER BY date DESC, medication_name ASC
        """
        with self.connect() as conn:
            df = pd.read_sql_query(
                query,
                conn,
                params=(source_name, start_date.isoformat(), as_of.isoformat()),
            )
        if not df.empty:
            df["date"] = pd.to_datetime(df["date"]).dt.date
            df["dose_taken"] = df["dose_taken"].fillna(0).astype(int)
        return df

    def save_prediction(
        self,
        prediction_timestamp: datetime,
        prediction_date: str,
        source_name: str,
        overall_risk_score: float,
        hrv_component: float,
        trend_component: float,
        alert_component: float,
        anomaly_component: float,
        symptom_component: float,
        medication_component: float,
        risk_level: str,
        recommendations: list[str],
        data_quality_notes: list[str],
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO ms_risk_predictions (
                    prediction_timestamp,
                    prediction_date,
                    source_name,
                    overall_risk_score,
                    hrv_component,
                    trend_component,
                    alert_component,
                    anomaly_component,
                    symptom_component,
                    medication_component,
                    risk_level,
                    recommendations,
                    data_quality_notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    prediction_timestamp.isoformat(timespec="seconds"),
                    prediction_date,
                    source_name,
                    overall_risk_score,
                    hrv_component,
                    trend_component,
                    alert_component,
                    anomaly_component,
                    symptom_component,
                    medication_component,
                    risk_level,
                    "\n".join(recommendations),
                    "\n".join(data_quality_notes),
                ),
            )
            conn.commit()

    def get_risk_history(self, source_name: str, days: int = 30, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days - 1)

        query = """
            SELECT *
            FROM ms_risk_predictions
            WHERE source_name = ?
              AND prediction_date >= ?
              AND prediction_date <= ?
            ORDER BY prediction_timestamp DESC
        """
        with self.connect() as conn:
            return pd.read_sql_query(
                query,
                conn,
                params=(source_name, start_date.isoformat(), as_of.isoformat()),
            )