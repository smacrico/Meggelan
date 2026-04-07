from __future__ import annotations

import logging
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from statistics import mean, pstdev
from typing import Any, Iterator

import numpy as np
import pandas as pd


logger = logging.getLogger(__name__)


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

@dataclass(frozen=True)
class FlareRiskConfig:
    """Configuration for flare-risk scoring.

    This is a rules-based heuristic score, not a clinically validated predictor.
    """

    hrv_recent_days: int = 7
    hrv_baseline_days: int = 30

    sleep_recent_days: int = 7
    sleep_baseline_days: int = 30

    stress_recent_days: int = 5
    stress_baseline_days: int = 30

    symptom_recent_days: int = 5
    symptom_baseline_days: int = 30

    environmental_recent_days: int = 3
    medication_adherence_days: int = 30

    min_recent_points: int = 4
    min_baseline_points: int = 10

    # Heuristic thresholds
    heat_temp_threshold_c: float = 25.0
    humidity_threshold_pct: float = 70.0
    pressure_change_threshold: float = 5.0
    medication_adherence_threshold: float = 0.85

    # Symptom scaling assumptions: symptoms logged on 0-10 or similar ordinal scale
    symptom_std_floor: float = 1.0
    stress_std_floor: float = 1.0

    # Final weights must sum to 1.0
    weights: dict[str, float] = field(
        default_factory=lambda: {
            "hrv_decline": 0.22,
            "sleep_disruption": 0.22,
            "stress_elevation": 0.16,
            "symptom_worsening": 0.20,
            "environmental_triggers": 0.10,
            "medication_gaps": 0.10,
        }
    )

    def __post_init__(self) -> None:
        required = {
            "hrv_decline",
            "sleep_disruption",
            "stress_elevation",
            "symptom_worsening",
            "environmental_triggers",
            "medication_gaps",
        }
        actual = set(self.weights.keys())
        missing = required - actual
        extra = actual - required
        if missing or extra:
            raise ValueError(f"Invalid weight keys. Missing={missing}, Extra={extra}")

        total = sum(self.weights.values())
        if not np.isclose(total, 1.0):
            raise ValueError(f"Weights must sum to 1.0, got {total:.6f}")


# -----------------------------------------------------------------------------
# Data models
# -----------------------------------------------------------------------------

@dataclass(frozen=True)
class RiskComponents:
    hrv_decline: float
    sleep_disruption: float
    stress_elevation: float
    symptom_worsening: float
    environmental_triggers: float
    medication_gaps: float

    def as_dict(self) -> dict[str, float]:
        return {
            "hrv_decline": self.hrv_decline,
            "sleep_disruption": self.sleep_disruption,
            "stress_elevation": self.stress_elevation,
            "symptom_worsening": self.symptom_worsening,
            "environmental_triggers": self.environmental_triggers,
            "medication_gaps": self.medication_gaps,
        }


@dataclass(frozen=True)
class RiskResult:
    prediction_timestamp: datetime
    overall_risk_score: float
    risk_level: str
    components: RiskComponents
    recommendations: list[str]
    data_quality_notes: list[str]


# -----------------------------------------------------------------------------
# Database access
# -----------------------------------------------------------------------------

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

    def initialize_database(self) -> None:
        with self.connect() as conn:
            cursor = conn.cursor()

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS daily_metrics (
                    date TEXT PRIMARY KEY,
                    hrv_rmssd REAL,
                    sleep_score REAL,
                    deep_sleep_minutes REAL,
                    rem_sleep_minutes REAL,
                    stress_avg REAL,
                    resting_hr REAL,
                    body_battery_start REAL,
                    body_battery_end REAL,
                    temperature_celsius REAL,
                    humidity_percent REAL,
                    barometric_pressure REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS medication_log (
                    date TEXT NOT NULL,
                    medication_name TEXT NOT NULL,
                    scheduled_dose_time TEXT NOT NULL,
                    actual_dose_time TEXT,
                    dose_taken INTEGER,
                    side_effects TEXT,
                    PRIMARY KEY (date, medication_name, scheduled_dose_time)
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS symptom_log (
                    date TEXT PRIMARY KEY,
                    fatigue_level INTEGER,
                    cognitive_fog INTEGER,
                    mobility_score INTEGER,
                    pain_level INTEGER,
                    mood_score INTEGER,
                    heat_sensitivity INTEGER,
                    overall_wellbeing INTEGER,
                    notes TEXT
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS flare_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    flare_date TEXT NOT NULL,
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
                CREATE TABLE IF NOT EXISTS risk_predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prediction_timestamp TEXT NOT NULL,
                    prediction_date TEXT NOT NULL,
                    overall_risk_score REAL NOT NULL,
                    hrv_risk REAL NOT NULL,
                    sleep_risk REAL NOT NULL,
                    stress_risk REAL NOT NULL,
                    symptom_risk REAL NOT NULL,
                    environmental_risk REAL NOT NULL,
                    medication_risk REAL NOT NULL,
                    risk_level TEXT NOT NULL,
                    recommendations TEXT NOT NULL,
                    data_quality_notes TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute("CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_medication_log_date_med ON medication_log(date, medication_name)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_symptom_log_date ON symptom_log(date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_risk_predictions_date ON risk_predictions(prediction_date)")

            conn.commit()

    def get_recent_joined_data(self, days_back: int, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days_back - 1)

        query = """
            SELECT
                dm.date,
                dm.hrv_rmssd,
                dm.sleep_score,
                dm.deep_sleep_minutes,
                dm.rem_sleep_minutes,
                dm.stress_avg,
                dm.resting_hr,
                dm.body_battery_start,
                dm.body_battery_end,
                dm.temperature_celsius,
                dm.humidity_percent,
                dm.barometric_pressure,
                sl.fatigue_level,
                sl.cognitive_fog,
                sl.mobility_score,
                sl.pain_level,
                sl.mood_score,
                sl.heat_sensitivity,
                sl.overall_wellbeing
            FROM daily_metrics dm
            LEFT JOIN symptom_log sl
                ON dm.date = sl.date
            WHERE dm.date >= ? AND dm.date <= ?
            ORDER BY dm.date DESC
        """

        with self.connect() as conn:
            df = pd.read_sql_query(
                query,
                conn,
                params=(start_date.strftime("%Y-%m-%d"), as_of.strftime("%Y-%m-%d")),
            )

        if not df.empty:
            df["date"] = pd.to_datetime(df["date"]).dt.date

        return df

    def get_medication_data(self, days_back: int, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days_back - 1)

        query = """
            SELECT
                date,
                medication_name,
                scheduled_dose_time,
                actual_dose_time,
                dose_taken
            FROM medication_log
            WHERE date >= ? AND date <= ?
            ORDER BY date DESC, medication_name ASC
        """

        with self.connect() as conn:
            df = pd.read_sql_query(
                query,
                conn,
                params=(start_date.strftime("%Y-%m-%d"), as_of.strftime("%Y-%m-%d")),
            )

        if not df.empty:
            df["date"] = pd.to_datetime(df["date"]).dt.date
            df["dose_taken"] = df["dose_taken"].fillna(0).astype(int)

        return df

    def save_prediction(self, result: RiskResult) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO risk_predictions (
                    prediction_timestamp,
                    prediction_date,
                    overall_risk_score,
                    hrv_risk,
                    sleep_risk,
                    stress_risk,
                    symptom_risk,
                    environmental_risk,
                    medication_risk,
                    risk_level,
                    recommendations,
                    data_quality_notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    result.prediction_timestamp.isoformat(timespec="seconds"),
                    result.prediction_timestamp.date().isoformat(),
                    result.overall_risk_score,
                    result.components.hrv_decline,
                    result.components.sleep_disruption,
                    result.components.stress_elevation,
                    result.components.symptom_worsening,
                    result.components.environmental_triggers,
                    result.components.medication_gaps,
                    result.risk_level,
                    "\n".join(result.recommendations),
                    "\n".join(result.data_quality_notes),
                ),
            )
            conn.commit()

    def get_risk_history(self, days: int = 30, as_of: date | None = None) -> pd.DataFrame:
        as_of = as_of or datetime.now().date()
        start_date = as_of - timedelta(days=days - 1)

        query = """
            SELECT *
            FROM risk_predictions
            WHERE prediction_date >= ? AND prediction_date <= ?
            ORDER BY prediction_timestamp DESC
        """

        with self.connect() as conn:
            df = pd.read_sql_query(
                query,
                conn,
                params=(start_date.strftime("%Y-%m-%d"), as_of.strftime("%Y-%m-%d")),
            )

        return df


# -----------------------------------------------------------------------------
# Pure helper functions: unit-testable
# -----------------------------------------------------------------------------

def clamp01(value: float) -> float:
    return float(max(0.0, min(1.0, value)))


def split_recent_and_baseline(
    series: pd.Series,
    recent_days: int,
    baseline_days: int,
) -> tuple[pd.Series, pd.Series]:
    """Split a descending time series into non-overlapping recent and baseline windows.

    Input series is assumed ordered newest -> oldest.
    """
    clean = series.dropna().reset_index(drop=True)
    recent = clean.iloc[:recent_days]
    baseline = clean.iloc[recent_days : recent_days + baseline_days]
    return recent, baseline


def compute_percent_drop_risk(
    recent: pd.Series,
    baseline: pd.Series,
    min_recent_points: int,
    min_baseline_points: int,
) -> float:
    if len(recent) < min_recent_points or len(baseline) < min_baseline_points:
        return 0.0

    baseline_avg = float(baseline.mean())
    recent_avg = float(recent.mean())
    if baseline_avg <= 0:
        return 0.0

    drop_ratio = (baseline_avg - recent_avg) / baseline_avg
    return clamp01(drop_ratio)


def compute_normalized_negative_slope_risk(
    recent: pd.Series,
    denominator_floor: float = 1e-6,
) -> float:
    if len(recent) < 3:
        return 0.0

    y = recent.to_numpy(dtype=float)
    x = np.arange(len(y), dtype=float)
    slope = float(np.polyfit(x, y, 1)[0])

    denom = max(float(np.mean(y)), denominator_floor)
    normalized = -slope / denom
    return clamp01(normalized)


def compute_zscore_elevation_risk(
    recent: pd.Series,
    baseline: pd.Series,
    min_recent_points: int,
    min_baseline_points: int,
    std_floor: float,
    threshold_z: float,
) -> float:
    if len(recent) < min_recent_points or len(baseline) < min_baseline_points:
        return 0.0

    recent_avg = float(recent.mean())
    baseline_avg = float(baseline.mean())
    baseline_std = max(float(baseline.std(ddof=0)), std_floor)

    z = (recent_avg - baseline_avg) / baseline_std
    return clamp01(z / threshold_z)


def compute_hrv_decline_risk(
    hrv_series_desc: pd.Series,
    recent_days: int,
    baseline_days: int,
    min_recent_points: int,
    min_baseline_points: int,
) -> float:
    recent, baseline = split_recent_and_baseline(hrv_series_desc, recent_days, baseline_days)
    level_risk = compute_percent_drop_risk(recent, baseline, min_recent_points, min_baseline_points)
    slope_risk = compute_normalized_negative_slope_risk(recent)
    return clamp01(level_risk * 0.7 + slope_risk * 0.3)


def compute_sleep_disruption_risk(
    sleep_score_desc: pd.Series,
    deep_sleep_desc: pd.Series,
    rem_sleep_desc: pd.Series,
    recent_days: int,
    baseline_days: int,
    min_recent_points: int,
    min_baseline_points: int,
) -> float:
    sleep_recent, sleep_baseline = split_recent_and_baseline(sleep_score_desc, recent_days, baseline_days)
    deep_recent, deep_baseline = split_recent_and_baseline(deep_sleep_desc, recent_days, baseline_days)
    rem_recent, rem_baseline = split_recent_and_baseline(rem_sleep_desc, recent_days, baseline_days)

    sleep_score_risk = compute_percent_drop_risk(
        sleep_recent, sleep_baseline, min_recent_points, min_baseline_points
    )
    deep_risk = compute_percent_drop_risk(
        deep_recent, deep_baseline, min_recent_points, min_baseline_points
    )
    rem_risk = compute_percent_drop_risk(
        rem_recent, rem_baseline, min_recent_points, min_baseline_points
    )

    variability_risk = 0.0
    if len(sleep_recent) >= min_recent_points:
        recent_mean = float(sleep_recent.mean())
        recent_std = float(sleep_recent.std(ddof=0))
        if recent_mean > 0:
            variability_risk = clamp01((recent_std / recent_mean) / 0.5)

    return clamp01(
        sleep_score_risk * 0.45
        + deep_risk * 0.25
        + rem_risk * 0.20
        + variability_risk * 0.10
    )


def compute_stress_elevation_risk(
    stress_desc: pd.Series,
    recent_days: int,
    baseline_days: int,
    min_recent_points: int,
    min_baseline_points: int,
    std_floor: float,
    threshold_z: float = 1.5,
) -> float:
    recent, baseline = split_recent_and_baseline(stress_desc, recent_days, baseline_days)
    return compute_zscore_elevation_risk(
        recent=recent,
        baseline=baseline,
        min_recent_points=min_recent_points,
        min_baseline_points=min_baseline_points,
        std_floor=std_floor,
        threshold_z=threshold_z,
    )


def compute_symptom_worsening_risk(
    df_desc: pd.DataFrame,
    recent_days: int,
    baseline_days: int,
    min_recent_points: int,
    min_baseline_points: int,
    std_floor: float,
) -> float:
    """Integrate recent symptom worsening into a single risk score.

    Higher is worse for:
    - fatigue_level
    - cognitive_fog
    - pain_level
    - heat_sensitivity

    Lower is worse for:
    - mobility_score
    - mood_score
    - overall_wellbeing
    """
    symptom_specs: list[tuple[str, int]] = [
        ("fatigue_level", +1),
        ("cognitive_fog", +1),
        ("pain_level", +1),
        ("heat_sensitivity", +1),
        ("mobility_score", -1),
        ("mood_score", -1),
        ("overall_wellbeing", -1),
    ]

    component_scores: list[float] = []

    for column, direction in symptom_specs:
        if column not in df_desc.columns:
            continue

        series = df_desc[column].dropna().reset_index(drop=True)
        recent, baseline = split_recent_and_baseline(series, recent_days, baseline_days)

        if len(recent) < min_recent_points or len(baseline) < min_baseline_points:
            continue

        recent_avg = float(recent.mean())
        baseline_avg = float(baseline.mean())
        baseline_std = max(float(baseline.std(ddof=0)), std_floor)

        delta = (recent_avg - baseline_avg) * direction
        z = delta / baseline_std
        component_scores.append(clamp01(z / 1.5))

    if not component_scores:
        return 0.0

    return float(mean(component_scores))


def compute_environmental_trigger_risk(
    df_desc: pd.DataFrame,
    recent_days: int,
    heat_temp_threshold_c: float,
    humidity_threshold_pct: float,
    pressure_change_threshold: float,
) -> float:
    window = df_desc.head(recent_days).copy()
    if window.empty:
        return 0.0

    risk_factors: list[float] = []

    if "temperature_celsius" in window.columns:
        temp = window["temperature_celsius"].dropna()
        if not temp.empty:
            recent_temp = float(temp.mean())
            if recent_temp > heat_temp_threshold_c:
                risk_factors.append(clamp01((recent_temp - heat_temp_threshold_c) / 10.0))

    if "humidity_percent" in window.columns:
        humidity = window["humidity_percent"].dropna()
        if not humidity.empty:
            recent_humidity = float(humidity.mean())
            if recent_humidity > humidity_threshold_pct:
                risk_factors.append(clamp01((recent_humidity - humidity_threshold_pct) / 30.0))

    if "barometric_pressure" in window.columns:
        pressure = window["barometric_pressure"].dropna().reset_index(drop=True)
        if len(pressure) >= 2:
            pressure_change = abs(float(pressure.iloc[0]) - float(pressure.iloc[1]))
            if pressure_change > pressure_change_threshold:
                risk_factors.append(clamp01(pressure_change / 20.0))

    if not risk_factors:
        return 0.0

    return float(mean(risk_factors))


def compute_medication_gap_risk(
    medication_df: pd.DataFrame,
    adherence_threshold: float,
) -> float:
    if medication_df.empty:
        return 0.0

    total_doses = len(medication_df)
    taken_doses = int((medication_df["dose_taken"] == 1).sum())
    adherence_rate = taken_doses / total_doses if total_doses > 0 else 1.0

    if adherence_rate >= adherence_threshold:
        return 0.0

    return clamp01((adherence_threshold - adherence_rate) / adherence_threshold)


def combine_weighted_risks(
    components: RiskComponents,
    weights: dict[str, float],
) -> float:
    scores = components.as_dict()
    total = 0.0
    for key, value in scores.items():
        total += value * weights[key]
    return clamp01(total)


def classify_risk_level(score: float) -> str:
    if score <= 0.30:
        return "LOW"
    if score <= 0.60:
        return "MODERATE"
    if score <= 0.80:
        return "HIGH"
    return "CRITICAL"


# -----------------------------------------------------------------------------
# Orchestration service
# -----------------------------------------------------------------------------

class MSFlareRiskService:
    """Production-oriented rules-based flare-risk scoring service."""

    def __init__(self, db_path: str, config: FlareRiskConfig | None = None) -> None:
        self.db = DatabaseManager(db_path)
        self.config = config or FlareRiskConfig()

    def initialize_database(self) -> None:
        self.db.initialize_database()

    def predict(self, as_of: date | None = None, persist: bool = True) -> RiskResult:
        as_of = as_of or datetime.now().date()

        max_days = max(
            self.config.hrv_recent_days + self.config.hrv_baseline_days,
            self.config.sleep_recent_days + self.config.sleep_baseline_days,
            self.config.stress_recent_days + self.config.stress_baseline_days,
            self.config.symptom_recent_days + self.config.symptom_baseline_days,
            self.config.environmental_recent_days,
        )

        recent_data = self.db.get_recent_joined_data(days_back=max_days, as_of=as_of)
        medication_df = self.db.get_medication_data(
            days_back=self.config.medication_adherence_days,
            as_of=as_of,
        )

        data_quality_notes: list[str] = []

        if recent_data.empty:
            result = RiskResult(
                prediction_timestamp=datetime.now(),
                overall_risk_score=0.0,
                risk_level="UNKNOWN",
                components=RiskComponents(
                    hrv_decline=0.0,
                    sleep_disruption=0.0,
                    stress_elevation=0.0,
                    symptom_worsening=0.0,
                    environmental_triggers=0.0,
                    medication_gaps=0.0,
                ),
                recommendations=["No recent data available for flare-risk assessment."],
                data_quality_notes=["No recent daily_metrics rows found."],
            )
            if persist:
                self.db.save_prediction(result)
            return result

        # Ensure descending by date
        recent_data = recent_data.sort_values("date", ascending=False).reset_index(drop=True)

        components = RiskComponents(
            hrv_decline=compute_hrv_decline_risk(
                hrv_series_desc=recent_data["hrv_rmssd"],
                recent_days=self.config.hrv_recent_days,
                baseline_days=self.config.hrv_baseline_days,
                min_recent_points=self.config.min_recent_points,
                min_baseline_points=self.config.min_baseline_points,
            ),
            sleep_disruption=compute_sleep_disruption_risk(
                sleep_score_desc=recent_data["sleep_score"],
                deep_sleep_desc=recent_data["deep_sleep_minutes"],
                rem_sleep_desc=recent_data["rem_sleep_minutes"],
                recent_days=self.config.sleep_recent_days,
                baseline_days=self.config.sleep_baseline_days,
                min_recent_points=self.config.min_recent_points,
                min_baseline_points=self.config.min_baseline_points,
            ),
            stress_elevation=compute_stress_elevation_risk(
                stress_desc=recent_data["stress_avg"],
                recent_days=self.config.stress_recent_days,
                baseline_days=self.config.stress_baseline_days,
                min_recent_points=self.config.min_recent_points,
                min_baseline_points=self.config.min_baseline_points,
                std_floor=self.config.stress_std_floor,
                threshold_z=1.5,
            ),
            symptom_worsening=compute_symptom_worsening_risk(
                df_desc=recent_data,
                recent_days=self.config.symptom_recent_days,
                baseline_days=self.config.symptom_baseline_days,
                min_recent_points=self.config.min_recent_points,
                min_baseline_points=self.config.min_baseline_points,
                std_floor=self.config.symptom_std_floor,
            ),
            environmental_triggers=compute_environmental_trigger_risk(
                df_desc=recent_data,
                recent_days=self.config.environmental_recent_days,
                heat_temp_threshold_c=self.config.heat_temp_threshold_c,
                humidity_threshold_pct=self.config.humidity_threshold_pct,
                pressure_change_threshold=self.config.pressure_change_threshold,
            ),
            medication_gaps=compute_medication_gap_risk(
                medication_df=medication_df,
                adherence_threshold=self.config.medication_adherence_threshold,
            ),
        )

        overall = combine_weighted_risks(components, self.config.weights)
        level = classify_risk_level(overall)

        data_quality_notes.extend(self._build_data_quality_notes(recent_data, medication_df))
        recommendations = self._generate_recommendations(components, level)

        result = RiskResult(
            prediction_timestamp=datetime.now(),
            overall_risk_score=overall,
            risk_level=level,
            components=components,
            recommendations=recommendations,
            data_quality_notes=data_quality_notes,
        )

        if persist:
            self.db.save_prediction(result)

        logger.info(
            "Flare-risk assessment complete: level=%s score=%.3f",
            result.risk_level,
            result.overall_risk_score,
        )
        return result

    def get_risk_history(self, days: int = 30, as_of: date | None = None) -> pd.DataFrame:
        return self.db.get_risk_history(days=days, as_of=as_of)

    def _build_data_quality_notes(
        self,
        recent_data: pd.DataFrame,
        medication_df: pd.DataFrame,
    ) -> list[str]:
        notes: list[str] = []

        metrics_to_check = [
            "hrv_rmssd",
            "sleep_score",
            "deep_sleep_minutes",
            "rem_sleep_minutes",
            "stress_avg",
        ]
        for col in metrics_to_check:
            if col in recent_data.columns:
                non_null = int(recent_data[col].notna().sum())
                if non_null < self.config.min_recent_points:
                    notes.append(f"Low data coverage for {col}: only {non_null} valid points.")

        symptom_cols = [
            "fatigue_level",
            "cognitive_fog",
            "mobility_score",
            "pain_level",
            "mood_score",
            "heat_sensitivity",
            "overall_wellbeing",
        ]
        symptom_non_null = int(recent_data[symptom_cols].notna().sum().sum()) if set(symptom_cols).issubset(recent_data.columns) else 0
        if symptom_non_null == 0:
            notes.append("No recent symptom log data available.")

        if medication_df.empty:
            notes.append("No recent medication log data available.")

        return notes

    def _generate_recommendations(
        self,
        components: RiskComponents,
        risk_level: str,
    ) -> list[str]:
        recommendations: list[str] = []

        if risk_level == "CRITICAL":
            recommendations.append(
                "High-risk pattern detected. Consider contacting your clinician promptly, especially if symptoms are worsening."
            )
            recommendations.append("Reduce exertion, prioritize rest, and minimize heat exposure.")
        elif risk_level == "HIGH":
            recommendations.append(
                "High-risk pattern detected. Consider reviewing symptoms and your care plan with your clinician."
            )
            recommendations.append("Prioritize sleep, hydration, cooling, and stress reduction today.")
        elif risk_level == "MODERATE":
            recommendations.append("Moderate risk pattern detected. Use preventive strategies and monitor symptoms closely.")
        else:
            recommendations.append("Low overall risk pattern today. Continue current routines and monitoring.")

        if components.hrv_decline >= 0.5:
            recommendations.append("Recent HRV decline detected. Consider gentle pacing and recovery-focused activity.")

        if components.sleep_disruption >= 0.5:
            recommendations.append("Sleep disruption detected. Review sleep hygiene and prioritize consistent sleep timing.")

        if components.stress_elevation >= 0.5:
            recommendations.append("Stress elevation detected. Consider breathing exercises, rest breaks, or relaxation strategies.")

        if components.symptom_worsening >= 0.5:
            recommendations.append("Recent symptom worsening detected. Track symptom progression carefully and avoid overexertion.")

        if components.environmental_triggers >= 0.5:
            recommendations.append("Environmental trigger pattern detected. Stay cool, hydrated, and avoid heat where possible.")

        if components.medication_gaps >= 0.3:
            recommendations.append("Medication adherence issue detected. Review reminders and dosing consistency.")

        return recommendations


# -----------------------------------------------------------------------------
# Example CLI-style entry point
# -----------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

    db_path = "ms_flare_prediction.db"
    service = MSFlareRiskService(db_path=db_path)
    service.initialize_database()

    result = service.predict(persist=True)

    print("\n" + "=" * 60)
    print("MS FLARE RISK ASSESSMENT")
    print("=" * 60)
    print(f"Date: {result.prediction_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Overall Risk Score: {result.overall_risk_score:.3f}")
    print(f"Risk Level: {result.risk_level}")

    print("\nRisk Components:")
    for name, value in result.components.as_dict().items():
        print(f"  - {name}: {value:.3f}")

    if result.data_quality_notes:
        print("\nData Quality Notes:")
        for note in result.data_quality_notes:
            print(f"  - {note}")

    print("\nRecommendations:")
    for rec in result.recommendations:
        print(f"  - {rec}")

    print("=" * 60)


if __name__ == "__main__":
    main()