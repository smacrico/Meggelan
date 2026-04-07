# Usage Example


from ms_flare_risk import FlareRiskConfig, MSFlareRiskService

db_path = "hrv_platform.db"

service = MSFlareRiskService(db_path=db_path, config=FlareRiskConfig())
service.initialize_support_tables()

result = service.predict(source_name="MyHRV_import")

print(result.risk_level, result.overall_risk_score)
print(result.components.as_dict())