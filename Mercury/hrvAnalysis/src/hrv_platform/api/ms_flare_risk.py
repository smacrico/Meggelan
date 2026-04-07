from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..ms_flare_risk.service import MSFlareRiskService
from ..ms_flare_risk.config import FlareRiskConfig

router = APIRouter()


def _build_service() -> MSFlareRiskService:
    service = MSFlareRiskService(
        db_path="hrv_platform.db",
        config=FlareRiskConfig(),
    )
    service.initialize_support_tables()
    return service


@router.get("/api/ms-flare-risk")
def get_ms_flare_risk(
    source_name: str = Query(default="MyHRV_import"),
    persist: bool = Query(default=False),
) -> dict:
    try:
        service = _build_service()
        result = service.predict(source_name=source_name, persist=persist)

        return {
            "prediction_timestamp": result.prediction_timestamp.isoformat(),
            "source_name": result.source_name,
            "overall_risk_score": round(result.overall_risk_score, 6),
            "risk_level": result.risk_level,
            "components": result.components.as_dict(),
            "recommendations": result.recommendations,
            "data_quality_notes": result.data_quality_notes,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"ms flare risk failed: {type(exc).__name__}: {exc}",
        )


@router.get("/api/ms-flare-risk/history")
def get_ms_flare_risk_history(
    source_name: str = Query(default="MyHRV_import"),
    days: int = Query(default=30, ge=1, le=3650),
) -> list[dict]:
    try:
        service = _build_service()
        history = service.get_risk_history(source_name=source_name, days=days)

        if history.empty:
            return []

        records: list[dict] = []
        for _, row in history.iterrows():
            records.append(
                {
                    "id": int(row["id"]),
                    "prediction_timestamp": row["prediction_timestamp"],
                    "prediction_date": row["prediction_date"],
                    "source_name": row["source_name"],
                    "overall_risk_score": float(row["overall_risk_score"]),
                    "hrv_component": float(row["hrv_component"]),
                    "trend_component": float(row["trend_component"]),
                    "alert_component": float(row["alert_component"]),
                    "anomaly_component": float(row["anomaly_component"]),
                    "symptom_component": float(row["symptom_component"]),
                    "medication_component": float(row["medication_component"]),
                    "risk_level": row["risk_level"],
                    "recommendations": row["recommendations"].split("\n") if row["recommendations"] else [],
                    "data_quality_notes": row["data_quality_notes"].split("\n") if row["data_quality_notes"] else [],
                }
            )

        return records
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"ms flare risk history failed: {type(exc).__name__}: {exc}",
        )