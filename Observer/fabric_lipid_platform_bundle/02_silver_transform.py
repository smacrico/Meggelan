# Fabric Notebook: 02_silver_transform
# Recommended default Lakehouse: lh_silver_health
# Assumption: Bronze tables are available through OneLake shortcut or attached lakehouse.

from pyspark.sql import functions as F
from pyspark.sql.window import Window

patient_key = "SELF_OR_UNKNOWN"
source_table = "brz_lipid_raw_lipid_data"

def to_double(c):
    return F.regexp_replace(F.trim(F.col(c)), ",", ".").cast("double")

def excel_or_iso_date(c):
    raw = F.trim(F.col(c))
    return (
        F.when(raw.rlike(r"^[0-9]+(\\.0)?$"), F.expr(f"date_add(to_date('1899-12-30'), cast(cast({c} as double) as int))"))
         .otherwise(F.to_date(raw))
    )

raw = spark.table(source_table)

silver = (
    raw
    .withColumn("exam_date", excel_or_iso_date("exam_date"))
    .withColumn("total_cholesterol_mg_dl", to_double("total_cholesterol"))
    .withColumn("hdl_mg_dl", to_double("hdl"))
    .withColumn("ldl_mg_dl", to_double("ldl"))
    .withColumn("triglycerides_mg_dl", to_double("triglycerides"))
    .withColumn("reported_non_hdl_mg_dl", to_double("reported_non_hdl"))
    .withColumn("lpa_mg_dl", to_double("lp_a"))
    .withColumn("patient_key", F.lit(patient_key))
    .withColumn("calculated_non_hdl_mg_dl", F.when(F.col("total_cholesterol_mg_dl").isNotNull() & F.col("hdl_mg_dl").isNotNull(), F.col("total_cholesterol_mg_dl") - F.col("hdl_mg_dl")))
    .withColumn("tc_hdl_ratio", F.when(F.col("total_cholesterol_mg_dl").isNotNull() & (F.col("hdl_mg_dl") > 0), F.col("total_cholesterol_mg_dl") / F.col("hdl_mg_dl")))
    .withColumn("ldl_hdl_ratio", F.when(F.col("ldl_mg_dl").isNotNull() & (F.col("hdl_mg_dl") > 0), F.col("ldl_mg_dl") / F.col("hdl_mg_dl")))
    .withColumn("tg_hdl_ratio", F.when(F.col("triglycerides_mg_dl").isNotNull() & (F.col("hdl_mg_dl") > 0), F.col("triglycerides_mg_dl") / F.col("hdl_mg_dl")))
    .withColumn("aip", F.when(F.col("triglycerides_mg_dl") > 0, F.log10(F.col("tg_hdl_ratio"))))
    .withColumn("remnant_cholesterol_mg_dl", F.when(F.col("total_cholesterol_mg_dl").isNotNull() & F.col("ldl_mg_dl").isNotNull() & F.col("hdl_mg_dl").isNotNull(), F.col("total_cholesterol_mg_dl") - F.col("ldl_mg_dl") - F.col("hdl_mg_dl")))
    .withColumn("aip_risk_band", F.when(F.col("aip").isNull(), None).when(F.col("aip") < 0.11, "Low").when(F.col("aip") <= 0.21, "Intermediate").otherwise("High"))
    .withColumn("tg_hdl_risk_band", F.when(F.col("tg_hdl_ratio").isNull(), None).when(F.col("tg_hdl_ratio") < 2.0, "Good").when(F.col("tg_hdl_ratio") <= 3.0, "Borderline").otherwise("Elevated"))
    .withColumn("is_complete_basic_panel", F.col("total_cholesterol_mg_dl").isNotNull() & F.col("hdl_mg_dl").isNotNull() & F.col("ldl_mg_dl").isNotNull() & F.col("triglycerides_mg_dl").isNotNull())
    .withColumn("has_negative_remnant_cholesterol", F.col("remnant_cholesterol_mg_dl") < 0)
    .withColumn("missing_measure_list", F.concat_ws(",", F.when(F.col("total_cholesterol_mg_dl").isNull(), "total_cholesterol"), F.when(F.col("hdl_mg_dl").isNull(), "hdl"), F.when(F.col("ldl_mg_dl").isNull(), "ldl"), F.when(F.col("triglycerides_mg_dl").isNull(), "triglycerides")))
    .withColumn("data_quality_status", F.when(F.col("exam_date").isNull(), "REJECT_DATE").when(~F.col("is_complete_basic_panel"), "PARTIAL_PANEL").when(F.col("has_negative_remnant_cholesterol"), "CHECK_DERIVED_METRIC").otherwise("VALID"))
    .withColumn("silver_load_ts_utc", F.current_timestamp())
    .select(
        "patient_key", "exam_date", "total_cholesterol_mg_dl", "hdl_mg_dl", "ldl_mg_dl", "triglycerides_mg_dl", "reported_non_hdl_mg_dl", "lpa_mg_dl",
        "calculated_non_hdl_mg_dl", "tc_hdl_ratio", "ldl_hdl_ratio", "tg_hdl_ratio", "aip", "remnant_cholesterol_mg_dl", "aip_risk_band", "tg_hdl_risk_band",
        "is_complete_basic_panel", "has_negative_remnant_cholesterol", "missing_measure_list", "data_quality_status",
        "source_file_name", "source_file_path", "source_sheet", "ingest_run_id", "ingest_ts_utc", "silver_load_ts_utc"
    )
    .dropDuplicates(["patient_key", "exam_date", "source_file_name"])
)

silver.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable("silver_lipid_panel")

latest = silver.orderBy(F.col("exam_date").desc()).limit(1)
display(latest)
