from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime

import pandas as pd

from .config import FlareRiskConfig
from .db import DatabaseManager
from .risk_components import (
    RiskComponents,
    classify_risk_level,
    combine_weighted_risks,
    compute_alert_component,
    compute_anomaly_component,
    compute_hrv_component,
    compute_medication_component,
    compute_symptom_component,
    compute_trend_component,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RiskResult:
    prediction_timestamp: datetime
    source_name: str
    overall_risk_score: float
    risk_level: str
    components: RiskComponents
    recommendations: list[str]
    data_quality_notes: list[str]


class MSFlareRiskService:
    """Flare-risk scorer built on existing hrv_platform analytics tables."""

    def __init__(self, db_path: str, config: FlareRiskConfig | None = None) -> None:
        self.db = DatabaseManager(db_path)
        self.config = config or FlareRiskConfig()

    def initialize_support_tables(self) -> None:
        self.db.initialize_support_tables()

    def predict(
        self,
        source_name: str = "MyHRV_import",
        as_of: date | None = None,
        persist: bool = True,
    ) -> RiskResult:
        as_of = as_of or datetime.now().date()

        measurements_df = self.db.get_measurements(
            source_name=source_name,
            days_back=self.config.recent_measurement_days,
            as_of=as_of,
        )
        baseline_df = self.db.get_latest_baseline(source_name=source_name)
        trends_df = self.db.get_latest_trends(source_name=source_name)
        alerts_df = self.db.get_recent_alerts(
            source_name=source_name,
            days_back=self.config.recent_event_days,
            as_of=as_of,
        )
        anomalies_df = self.db.get_recent_anomalies(
            source_name=source_name,
            days_back=self.config.recent_event_days,
            as_of=as_of,
        )
        symptoms_df = self.db.get_symptom_log(
            source_name=source_name,
            days_back=self.config.symptom_recent_days + self.config.symptom_baseline_days,
            as_of=as_of,
        )
        medications_df = self.db.get_medication_log(
            source_name=source_name,
            days_back=self.config.medication_adherence_days,
            as_of=as_of,
        )

        data_quality_notes = self._build_data_quality_notes(
            measurements_df=measurements_df,
            baseline_df=baseline_df,
            trends_df=trends_df,
            symptoms_df=symptoms_df,
            medications_df=medications_df,
        )

        components = RiskComponents(
            hrv_component=compute_hrv_component(
                latest_measurement_df=measurements_df.head(1),
                latest_baseline_df=baseline_df,
            ),
            trend_component=compute_trend_component(trends_df),
            alert_component=compute_alert_component(
                recent_alerts_df=alerts_df,
                days_back=self.config.recent_event_days,
            ),
            anomaly_component=compute_anomaly_component(
                recent_anomalies_df=anomalies_df,
                days_back=self.config.recent_event_days,
            ),
            symptom_component=compute_symptom_component(
                symptom_df_desc=symptoms_df,
                recent_days=self.config.symptom_recent_days,
                baseline_days=self.config.symptom_baseline_days,
                min_recent_points=self.config.min_recent_points,
                min_baseline_points=self.config.min_baseline_points,
                std_floor=self.config.symptom_std_floor,
            ),
            medication_component=compute_medication_component(
                medication_df=medications_df,
                adherence_threshold=self.config.medication_adherence_threshold,
            ),
        )

        overall_score = combine_weighted_risks(components, self.config.weights)
        risk_level = classify_risk_level(overall_score)
        recommendations = self._generate_recommendations(components, risk_level)

        result = RiskResult(
            prediction_timestamp=datetime.now(),
            source_name=source_name,
            overall_risk_score=overall_score,
            risk_level=risk_level,
            components=components,
            recommendations=recommendations,
            data_quality_notes=data_quality_notes,
        )

        if persist:
            self.db.save_prediction(
                prediction_timestamp=result.prediction_timestamp,
                prediction_date=result.prediction_timestamp.date().isoformat(),
                source_name=result.source_name,
                overall_risk_score=result.overall_risk_score,
                hrv_component=result.components.hrv_component,
                trend_component=result.components.trend_component,
                alert_component=result.components.alert_component,
                anomaly_component=result.components.anomaly_component,
                symptom_component=result.components.symptom_component,
                medication_component=result.components.medication_component,
                risk_level=result.risk_level,
                recommendations=result.recommendations,
                data_quality_notes=result.data_quality_notes,
            )

        return result

    def get_risk_history(
        self,
        source_name: str = "MyHRV_import",
        days: int = 30,
        as_of: date | None = None,
    ) -> pd.DataFrame:
        return self.db.get_risk_history(source_name=source_name, days=days, as_of=as_of)

    def _build_data_quality_notes(
        self,
        measurements_df: pd.DataFrame,
        baseline_df: pd.DataFrame,
        trends_df: pd.DataFrame,
        symptoms_df: pd.DataFrame,
        medications_df: pd.DataFrame,
    ) -> list[str]:
        notes: list[str] = []

        if measurements_df.empty:
            notes.append("No recent hrv_measurements data available.")

        if baseline_df.empty:
            notes.append("No hrv_baselines snapshot available.")

        if trends_df.empty:
            notes.append("No hrv_trends snapshot available.")

        if symptoms_df.empty:
            notes.append("No symptom_log data available.")

        if medications_df.empty:
            notes.append("No medication_log data available.")

        return notes

    def _generate_recommendations(
        self,
        components: RiskComponents,
        risk_level: str,
    ) -> list[str]:
        recommendations: list[str] = []

        if risk_level == "CRITICAL":
            recommendations.append(
                "High-risk pattern detected across HRV analytics and context signals. Consider contacting your clinician promptly, especially if symptoms are worsening."
            )
        elif risk_level == "HIGH":
            recommendations.append(
                "High-risk pattern detected. Reduce exertion, prioritize recovery, and review symptoms closely."
            )
        elif risk_level == "MODERATE":
            recommendations.append(
                "Moderate risk pattern detected. Use preventive strategies and monitor symptoms closely over the next few days."
            )
        else:
            recommendations.append("Low overall risk pattern. Continue current routines and monitoring.")

        if components.hrv_component >= 0.5:
            recommendations.append("Latest HRV values are materially below baseline. Prioritize rest and recovery.")

        if components.trend_component >= 0.5:
            recommendations.append("Recent HRV trend snapshot shows declining metrics. Avoid unnecessary strain.")

        if components.alert_component >= 0.5:
            recommendations.append("Recent HRV alerts are elevated. Review what changed in routine, exertion, sleep, or environment.")

        if components.anomaly_component >= 0.5:
            recommendations.append("Recent anomaly burden is elevated. Watch for symptom worsening and avoid overexertion.")

        if components.symptom_component >= 0.5:
            recommendations.append("Recent symptom worsening detected. Track symptoms carefully and consider escalating if they continue.")

        if components.medication_component >= 0.3:
            recommendations.append("Medication adherence issue detected. Review reminders and dosing consistency.")

        return recommendations