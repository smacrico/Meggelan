# Fabric Notebook: 03_gold_star_schema
# Purpose:
#   Read Silver lipid panel table from lh_silver by OneLake path.
#   Create Gold star-schema Delta tables in lh_gold.
#
# IMPORTANT:
#   Attach this notebook to lh_gold and pin lh_gold as the default Lakehouse.
#   This notebook intentionally stops if the default Lakehouse is not lh_gold.

# COMMAND ----------
# PARAMETERS CELL
# In Microsoft Fabric, mark this first cell as "parameters".
# Pipeline Notebook activity base parameters can override these values.

workspace_name_or_id = "<YOUR_WORKSPACE_ID_OR_NAME>"

silver_lakehouse_name = "lh_silver"
gold_lakehouse_name = "lh_gold"

silver_panel_table_name = "silver_lipid_panel"

# Gold table names
dim_date_table_name = "dim_date"
dim_patient_table_name = "dim_patient"
dim_marker_table_name = "dim_marker"
fact_lipid_panel_table_name = "fact_lipid_panel"
fact_lipid_result_table_name = "fact_lipid_result"
fact_lipid_trend_table_name = "fact_lipid_trend"

# Set to False only while debugging notebookutils/lakehouse metadata issues.
enforce_default_lakehouse = True

# COMMAND ----------
# IMPORTS

from pyspark.sql import functions as F


# COMMAND ----------
# NOTEBOOK / LAKEHOUSE HELPERS

def _load_notebookutils():
    nbu = globals().get("notebookutils")
    msu = globals().get("mssparkutils")

    if nbu is None:
        try:
            import notebookutils as imported_notebookutils
            nbu = imported_notebookutils
        except Exception:
            nbu = None

    if msu is None:
        try:
            import mssparkutils as imported_mssparkutils
            msu = imported_mssparkutils
        except Exception:
            try:
                from notebookutils import mssparkutils as imported_mssparkutils
                msu = imported_mssparkutils
            except Exception:
                msu = None

    return nbu, msu


notebookutils_ref, mssparkutils_ref = _load_notebookutils()


def _object_get(obj, key):
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def get_current_default_lakehouse_name():
    """
    Best-effort detection of the currently pinned/default Lakehouse.
    Different Fabric runtimes may return lakehouse metadata differently.
    """
    candidates = []

    for utils_obj in [notebookutils_ref, mssparkutils_ref]:
        try:
            lakehouse_obj = getattr(utils_obj, "lakehouse", None)
            if lakehouse_obj is not None and hasattr(lakehouse_obj, "get"):
                current = lakehouse_obj.get()
                candidates.append(current)
        except Exception:
            pass

    for current in candidates:
        for key in ["displayName", "name", "lakehouseName"]:
            value = _object_get(current, key)
            if value:
                return str(value)

    return None


def assert_default_lakehouse(expected_lakehouse_name: str):
    current = get_current_default_lakehouse_name()

    if current is None:
        if enforce_default_lakehouse:
            raise RuntimeError(
                "Could not determine the default Lakehouse from notebookutils. "
                f"Please confirm this notebook is attached to and pinned to '{expected_lakehouse_name}'. "
                "Then either rerun, or temporarily set enforce_default_lakehouse = False."
            )
        else:
            print(
                "WARNING: Could not determine the default Lakehouse. "
                "Continuing because enforce_default_lakehouse = False."
            )
            return

    print(f"Current default Lakehouse: {current}")

    if current.lower() != expected_lakehouse_name.lower():
        raise RuntimeError(
            f"Wrong default Lakehouse. Expected '{expected_lakehouse_name}', "
            f"but current default is '{current}'. "
            f"Move the notebook pin icon to '{expected_lakehouse_name}' before running."
        )


def make_onelake_table_root(workspace_value: str, lakehouse_name: str) -> str:
    workspace_value = str(workspace_value).strip()
    lakehouse_name = str(lakehouse_name).strip()

    if not workspace_value or workspace_value.startswith("<"):
        raise ValueError(
            "Parameter workspace_name_or_id still has a placeholder value. "
            "Set it to your Fabric workspace name or workspace ID."
        )

    if not lakehouse_name:
        raise ValueError("Lakehouse name cannot be blank.")

    return (
        f"abfss://{workspace_value}@onelake.dfs.fabric.microsoft.com/"
        f"{lakehouse_name}.Lakehouse/Tables"
    )


def table_path(table_root: str, table_name: str) -> str:
    return f"{table_root.rstrip('/')}/{table_name}"


# COMMAND ----------
# VALIDATE CONFIGURATION

workspace_name_or_id = str(workspace_name_or_id).strip()
silver_lakehouse_name = str(silver_lakehouse_name).strip()
gold_lakehouse_name = str(gold_lakehouse_name).strip()
silver_panel_table_name = str(silver_panel_table_name).strip()

assert_default_lakehouse(gold_lakehouse_name)

silver_table_root = make_onelake_table_root(workspace_name_or_id, silver_lakehouse_name)
silver_panel_table_path = table_path(silver_table_root, silver_panel_table_name)

print("Gold notebook configuration")
print(f"  workspace_name_or_id       : {workspace_name_or_id}")
print(f"  silver_lakehouse_name      : {silver_lakehouse_name}")
print(f"  gold_lakehouse_name        : {gold_lakehouse_name}")
print(f"  silver_panel_table_path    : {silver_panel_table_path}")


# COMMAND ----------
# READ SILVER TABLE BY ABSOLUTE ONELAKE PATH

silver_panel = spark.read.format("delta").load(silver_panel_table_path)

print(f"Read Silver rows: {silver_panel.count()}")
print("Silver columns:")
print(silver_panel.columns)

silver_panel.createOrReplaceTempView("vw_silver_lipid_panel")


# COMMAND ----------
# CREATE GOLD DIMENSIONS

spark.sql(f"""
CREATE OR REPLACE TABLE `{dim_patient_table_name}`
USING DELTA
AS
SELECT DISTINCT
    patient_key,
    CASE
        WHEN patient_key = 'SELF_OR_UNKNOWN' THEN 'Self / Unknown'
        ELSE patient_key
    END AS patient_display_name,
    current_timestamp() AS gold_load_ts_utc
FROM vw_silver_lipid_panel
WHERE patient_key IS NOT NULL
""")

spark.sql(f"""
CREATE OR REPLACE TABLE `{dim_date_table_name}`
USING DELTA
AS
WITH bounds AS (
    SELECT
        MIN(exam_date) AS min_date,
        MAX(exam_date) AS max_date
    FROM vw_silver_lipid_panel
    WHERE exam_date IS NOT NULL
),
date_series AS (
    SELECT explode(sequence(min_date, max_date, interval 1 day)) AS date
    FROM bounds
)
SELECT
    CAST(date_format(date, 'yyyyMMdd') AS INT) AS date_key,
    date,
    YEAR(date) AS year,
    QUARTER(date) AS quarter,
    MONTH(date) AS month_number,
    date_format(date, 'MMMM') AS month_name,
    date_format(date, 'yyyy-MM') AS year_month,
    DAY(date) AS day_of_month,
    DAYOFWEEK(date) AS day_of_week_number,
    date_format(date, 'EEEE') AS day_of_week_name,
    CASE WHEN DAYOFWEEK(date) IN (1, 7) THEN true ELSE false END AS is_weekend,
    current_timestamp() AS gold_load_ts_utc
FROM date_series
""")

spark.sql(f"""
CREATE OR REPLACE TABLE `{dim_marker_table_name}`
USING DELTA
AS
SELECT * FROM VALUES
  (1,  'TOTAL_CHOL',       'Total Cholesterol',   'mg/dL', 'Raw Lipid',     true,  'Lower is generally better'),
  (2,  'HDL',              'HDL',                 'mg/dL', 'Raw Lipid',     false, 'Higher is generally better'),
  (3,  'LDL',              'LDL',                 'mg/dL', 'Raw Lipid',     true,  'Lower is generally better'),
  (4,  'TRIGLYCERIDES',    'Triglycerides',       'mg/dL', 'Raw Lipid',     true,  'Lower is generally better'),
  (5,  'REPORTED_NON_HDL', 'Reported Non-HDL',    'mg/dL', 'Raw Lipid',     true,  'Lower is generally better'),
  (6,  'CALC_NON_HDL',     'Calculated Non-HDL',  'mg/dL', 'Derived Lipid', true,  'Lower is generally better'),
  (7,  'NON_HDL',          'Non-HDL',             'mg/dL', 'Derived Lipid', true,  'Lower is generally better'),
  (8,  'LPA',              'Lp(a)',               'mg/dL', 'Raw Lipid',     true,  'Lower is generally better'),
  (9,  'TC_HDL_RATIO',     'TC/HDL Ratio',        'ratio', 'Derived Ratio', true,  'Lower is generally better'),
  (10, 'LDL_HDL_RATIO',    'LDL/HDL Ratio',       'ratio', 'Derived Ratio', true,  'Lower is generally better'),
  (11, 'TG_HDL_RATIO',     'TG/HDL Ratio',        'ratio', 'Derived Ratio', true,  'Lower is generally better'),
  (12, 'AIP',              'AIP',                 'index', 'Derived Ratio', true,  'Lower is generally better'),
  (13, 'REMNANT_CHOL',     'Remnant Cholesterol', 'mg/dL', 'Derived Lipid', true,  'Lower is generally better')
AS marker(
    marker_key,
    marker_code,
    marker_name,
    unit,
    marker_category,
    lower_is_better,
    interpretation_note
)
""")


# COMMAND ----------
# CREATE GOLD FACT: ONE ROW PER LIPID PANEL DATE

spark.sql(f"""
CREATE OR REPLACE TABLE `{fact_lipid_panel_table_name}`
USING DELTA
AS
SELECT
    xxhash64(patient_key, exam_date, coalesce(source_row_hash, '')) AS lipid_panel_key,
    patient_key,
    CAST(date_format(exam_date, 'yyyyMMdd') AS INT) AS date_key,
    exam_date,
    previous_exam_date,

    total_cholesterol_mg_dl,
    hdl_mg_dl,
    ldl_mg_dl,
    triglycerides_mg_dl,
    reported_non_hdl_mg_dl,
    calculated_non_hdl_mg_dl,
    non_hdl_mg_dl,
    lpa_mg_dl,

    tc_hdl_ratio,
    ldl_hdl_ratio,
    tg_hdl_ratio,
    aip,
    remnant_cholesterol_mg_dl,

    aip_risk_band,
    tg_hdl_risk_band,

    previous_total_cholesterol_mg_dl,
    previous_hdl_mg_dl,
    previous_ldl_mg_dl,
    previous_triglycerides_mg_dl,
    previous_non_hdl_mg_dl,

    ldl_change_mg_dl,
    hdl_change_mg_dl,
    triglycerides_change_mg_dl,
    non_hdl_change_mg_dl,

    is_complete_basic_panel,
    has_negative_remnant_cholesterol,
    data_quality_status,

    source_system,
    data_domain,
    source_sheet,
    source_file_name,
    source_file_path,
    source_file_id,
    source_row_number,
    source_row_hash,
    ingest_run_id,
    bronze_ingest_ts_utc,
    silver_load_ts_utc,
    current_timestamp() AS gold_load_ts_utc
FROM vw_silver_lipid_panel
WHERE exam_date IS NOT NULL
""")


# COMMAND ----------
# CREATE GOLD FACT: ONE ROW PER MARKER RESULT

spark.sql(f"""
CREATE OR REPLACE TABLE `{fact_lipid_result_table_name}`
USING DELTA
AS
WITH unpivoted AS (
    SELECT
        patient_key,
        CAST(date_format(exam_date, 'yyyyMMdd') AS INT) AS date_key,
        exam_date,
        stack(
            13,
            'TOTAL_CHOL',       total_cholesterol_mg_dl,
            'HDL',              hdl_mg_dl,
            'LDL',              ldl_mg_dl,
            'TRIGLYCERIDES',    triglycerides_mg_dl,
            'REPORTED_NON_HDL', reported_non_hdl_mg_dl,
            'CALC_NON_HDL',     calculated_non_hdl_mg_dl,
            'NON_HDL',          non_hdl_mg_dl,
            'LPA',              lpa_mg_dl,
            'TC_HDL_RATIO',     tc_hdl_ratio,
            'LDL_HDL_RATIO',    ldl_hdl_ratio,
            'TG_HDL_RATIO',     tg_hdl_ratio,
            'AIP',              aip,
            'REMNANT_CHOL',     remnant_cholesterol_mg_dl
        ) AS (marker_code, result_value),
        data_quality_status,
        source_file_name,
        source_file_path,
        source_row_number,
        source_row_hash,
        ingest_run_id,
        silver_load_ts_utc
    FROM vw_silver_lipid_panel
    WHERE exam_date IS NOT NULL
)
SELECT
    xxhash64(u.patient_key, u.date_key, u.marker_code, coalesce(u.source_row_hash, '')) AS lipid_result_key,
    u.patient_key,
    u.date_key,
    u.exam_date,
    m.marker_key,
    u.marker_code,
    CAST(u.result_value AS DOUBLE) AS result_value,
    m.unit,
    m.marker_category,
    m.lower_is_better,
    u.data_quality_status,
    u.source_file_name,
    u.source_file_path,
    u.source_row_number,
    u.source_row_hash,
    u.ingest_run_id,
    u.silver_load_ts_utc,
    current_timestamp() AS gold_load_ts_utc
FROM unpivoted u
INNER JOIN `{dim_marker_table_name}` m
    ON u.marker_code = m.marker_code
WHERE u.result_value IS NOT NULL
""")


# COMMAND ----------
# CREATE GOLD FACT: MARKER TREND BY DATE

spark.sql(f"""
CREATE OR REPLACE TABLE `{fact_lipid_trend_table_name}`
USING DELTA
AS
WITH ordered_results AS (
    SELECT
        r.*,
        LAG(r.exam_date) OVER (
            PARTITION BY r.patient_key, r.marker_key
            ORDER BY r.exam_date
        ) AS previous_exam_date,
        LAG(r.result_value) OVER (
            PARTITION BY r.patient_key, r.marker_key
            ORDER BY r.exam_date
        ) AS previous_result_value
    FROM `{fact_lipid_result_table_name}` r
)
SELECT
    xxhash64(patient_key, marker_key, date_key, coalesce(source_row_hash, 'trend')) AS lipid_trend_key,
    patient_key,
    date_key,
    exam_date,
    previous_exam_date,
    marker_key,
    marker_code,
    result_value,
    previous_result_value,
    result_value - previous_result_value AS absolute_change,
    CASE
        WHEN previous_result_value IS NOT NULL AND previous_result_value != 0
        THEN (result_value - previous_result_value) / previous_result_value
        ELSE NULL
    END AS percent_change,
    CASE
        WHEN previous_result_value IS NULL THEN 'NO_PRIOR_RESULT'
        WHEN result_value > previous_result_value THEN 'INCREASED'
        WHEN result_value < previous_result_value THEN 'DECREASED'
        ELSE 'UNCHANGED'
    END AS trend_direction,
    data_quality_status,
    source_file_name,
    source_file_path,
    source_row_number,
    source_row_hash,
    ingest_run_id,
    silver_load_ts_utc,
    current_timestamp() AS gold_load_ts_utc
FROM ordered_results
""")


# COMMAND ----------
# OPTIONAL STATISTICS

for table_name in [
    dim_patient_table_name,
    dim_date_table_name,
    dim_marker_table_name,
    fact_lipid_panel_table_name,
    fact_lipid_result_table_name,
    fact_lipid_trend_table_name
]:
    try:
        spark.sql(f"ANALYZE TABLE `{table_name}` COMPUTE STATISTICS")
    except Exception as exc:
        print(f"Statistics warning for {table_name}: {exc}")


# COMMAND ----------
# VALIDATION

tables_to_validate = [
    dim_patient_table_name,
    dim_date_table_name,
    dim_marker_table_name,
    fact_lipid_panel_table_name,
    fact_lipid_result_table_name,
    fact_lipid_trend_table_name
]

validation_rows = []
for table_name in tables_to_validate:
    count_value = spark.table(table_name).count()
    validation_rows.append((table_name, count_value))

validation_df = spark.createDataFrame(validation_rows, ["table_name", "row_count"])

print("Gold validation")
display(validation_df)

display(
    spark.table(fact_lipid_panel_table_name)
    .orderBy(F.col("exam_date").desc_nulls_last())
    .limit(20)
)

display(
    spark.table(fact_lipid_result_table_name)
    .orderBy(F.col("exam_date").desc_nulls_last(), F.col("marker_key").asc())
    .limit(50)
)
