-- Fabric Spark SQL: 03_gold_star_schema
-- Recommended default Lakehouse: lh_gold_health
-- Assumption: silver_lipid_panel is available through OneLake shortcut or attached lakehouse.

CREATE OR REPLACE TABLE dim_patient
USING DELTA AS
SELECT DISTINCT
  patient_key,
  sha2(patient_key, 256) AS patient_hash,
  'Unknown / single attached workbook subject' AS patient_label
FROM silver_lipid_panel;

CREATE OR REPLACE TABLE dim_date
USING DELTA AS
SELECT DISTINCT
  CAST(date_format(exam_date, 'yyyyMMdd') AS INT) AS date_key,
  exam_date AS date,
  year(exam_date) AS year,
  quarter(exam_date) AS quarter,
  month(exam_date) AS month,
  date_format(exam_date, 'MMM') AS month_name,
  dayofmonth(exam_date) AS day_of_month
FROM silver_lipid_panel
WHERE exam_date IS NOT NULL;

CREATE OR REPLACE TABLE dim_marker
USING DELTA AS
SELECT * FROM VALUES
  (1,  'TOTAL_CHOL',       'Total Cholesterol',        'mg/dL', 'Raw Lipid',     true),
  (2,  'HDL',              'HDL',                      'mg/dL', 'Raw Lipid',     false),
  (3,  'LDL',              'LDL',                      'mg/dL', 'Raw Lipid',     true),
  (4,  'TRIGLYCERIDES',    'Triglycerides',            'mg/dL', 'Raw Lipid',     true),
  (5,  'REPORTED_NON_HDL', 'Reported Non-HDL',         'mg/dL', 'Raw Lipid',     true),
  (6,  'LPA',              'Lp(a)',                    'mg/dL', 'Raw Lipid',     true),
  (7,  'CALC_NON_HDL',     'Calculated Non-HDL',       'mg/dL', 'Derived Lipid', true),
  (8,  'TC_HDL_RATIO',     'TC/HDL Ratio',             'ratio', 'Derived Ratio', true),
  (9,  'LDL_HDL_RATIO',    'LDL/HDL Ratio',            'ratio', 'Derived Ratio', true),
  (10, 'TG_HDL_RATIO',     'TG/HDL Ratio',             'ratio', 'Derived Ratio', true),
  (11, 'AIP',              'AIP',                      'index', 'Derived Ratio', true),
  (12, 'REMNANT_CHOL',     'Remnant Cholesterol',      'mg/dL', 'Derived Lipid', true)
AS marker(marker_key, marker_code, marker_name, unit, marker_category, lower_is_better);

CREATE OR REPLACE TABLE fact_lipid_result
USING DELTA AS
WITH unpivoted AS (
  SELECT
    p.patient_key,
    CAST(date_format(p.exam_date, 'yyyyMMdd') AS INT) AS date_key,
    p.exam_date,
    stack(
      12,
      'TOTAL_CHOL',       p.total_cholesterol_mg_dl,
      'HDL',              p.hdl_mg_dl,
      'LDL',              p.ldl_mg_dl,
      'TRIGLYCERIDES',    p.triglycerides_mg_dl,
      'REPORTED_NON_HDL', p.reported_non_hdl_mg_dl,
      'LPA',              p.lpa_mg_dl,
      'CALC_NON_HDL',     p.calculated_non_hdl_mg_dl,
      'TC_HDL_RATIO',     p.tc_hdl_ratio,
      'LDL_HDL_RATIO',    p.ldl_hdl_ratio,
      'TG_HDL_RATIO',     p.tg_hdl_ratio,
      'AIP',              p.aip,
      'REMNANT_CHOL',     p.remnant_cholesterol_mg_dl
    ) AS (marker_code, result_value),
    p.data_quality_status,
    p.source_file_name,
    p.ingest_run_id,
    p.silver_load_ts_utc
  FROM silver_lipid_panel p
)
SELECT
  xxhash64(patient_key, date_key, marker_code, source_file_name) AS lipid_result_key,
  patient_key,
  date_key,
  exam_date,
  m.marker_key,
  result_value,
  m.unit,
  data_quality_status,
  source_file_name,
  ingest_run_id,
  silver_load_ts_utc
FROM unpivoted u
JOIN dim_marker m ON u.marker_code = m.marker_code
WHERE result_value IS NOT NULL;

CREATE OR REPLACE TABLE fact_lipid_panel
USING DELTA AS
SELECT
  xxhash64(patient_key, exam_date, source_file_name) AS lipid_panel_key,
  patient_key,
  CAST(date_format(exam_date, 'yyyyMMdd') AS INT) AS date_key,
  exam_date,
  total_cholesterol_mg_dl,
  hdl_mg_dl,
  ldl_mg_dl,
  triglycerides_mg_dl,
  lpa_mg_dl,
  calculated_non_hdl_mg_dl,
  tc_hdl_ratio,
  ldl_hdl_ratio,
  tg_hdl_ratio,
  aip,
  remnant_cholesterol_mg_dl,
  aip_risk_band,
  tg_hdl_risk_band,
  is_complete_basic_panel,
  data_quality_status,
  source_file_name,
  ingest_run_id
FROM silver_lipid_panel;

OPTIMIZE fact_lipid_result;
OPTIMIZE fact_lipid_panel;
