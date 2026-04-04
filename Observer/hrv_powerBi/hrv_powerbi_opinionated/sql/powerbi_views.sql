-- Opinionated Power BI starter SQL views for hrv_platform.db
DROP VIEW IF EXISTS vw_fact_measurements;
CREATE VIEW vw_fact_measurements AS
SELECT
    id AS measurement_id,
    measurement_date,
    source_name,
    SD1, SD2, sdnn, rmssd, pNN50, VLF, LF, HF,
    created_at
FROM hrv_measurements;

DROP VIEW IF EXISTS vw_fact_alerts;
CREATE VIEW vw_fact_alerts AS
SELECT
    id AS alert_id,
    alert_date,
    source_name,
    metric,
    current_value,
    baseline_value,
    deviation_pct,
    alert_type,
    alert_message,
    created_at
FROM hrv_alerts;

DROP VIEW IF EXISTS vw_fact_anomalies;
CREATE VIEW vw_fact_anomalies AS
SELECT
    id AS anomaly_id,
    detected_at,
    measurement_date,
    source_name,
    metric,
    value,
    baseline_mean,
    baseline_std,
    z_score,
    detector,
    message
FROM hrv_anomalies;

DROP VIEW IF EXISTS vw_fact_trends;
CREATE VIEW vw_fact_trends AS
SELECT
    id AS trend_id,
    analysis_date,
    source_name,
    metric,
    slope,
    r_value,
    p_value,
    trend_direction,
    trend_strength,
    mean,
    std,
    min,
    max,
    latest_ms_score
FROM hrv_trends;

DROP VIEW IF EXISTS vw_fact_baselines;
CREATE VIEW vw_fact_baselines AS
SELECT
    id AS baseline_id,
    analysis_date,
    source_name,
    avg_SD1, avg_SD2, avg_sdnn, avg_rmssd, avg_pNN50, avg_VLF, avg_LF, avg_HF,
    std_SD1, std_SD2, std_sdnn, std_rmssd, std_pNN50, std_VLF, std_LF, std_HF
FROM hrv_baselines;

DROP VIEW IF EXISTS vw_dim_date;
CREATE VIEW vw_dim_date AS
WITH RECURSIVE dates(d) AS (
    SELECT (SELECT MIN(measurement_date) FROM hrv_measurements)
    UNION ALL
    SELECT DATE(d, '+1 day') FROM dates
    WHERE d < (SELECT MAX(measurement_date) FROM hrv_measurements)
)
SELECT
    d AS date_key,
    CAST(STRFTIME('%Y', d) AS INTEGER) AS year,
    CAST(STRFTIME('%m', d) AS INTEGER) AS month_num,
    STRFTIME('%Y', d) || '-' || STRFTIME('%m', d) AS month_key,
    STRFTIME('%m', d) || ' - ' || STRFTIME('%Y', d) AS month_label,
    CAST(STRFTIME('%d', d) AS INTEGER) AS day_num,
    ((CAST(STRFTIME('%m', d) AS INTEGER)-1)/3)+1 AS quarter_num,
    CASE CAST(STRFTIME('%w', d) AS INTEGER)
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        ELSE 'Saturday'
    END AS weekday_name
FROM dates;

DROP VIEW IF EXISTS vw_dim_source;
CREATE VIEW vw_dim_source AS
SELECT DISTINCT source_name
FROM hrv_measurements;

DROP VIEW IF EXISTS vw_long_measurements;
CREATE VIEW vw_long_measurements AS
SELECT measurement_id, measurement_date, source_name, 'SD1' AS metric, SD1 AS value FROM vw_fact_measurements
UNION ALL SELECT measurement_id, measurement_date, source_name, 'SD2', SD2 FROM vw_fact_measurements
UNION ALL SELECT measurement_id, measurement_date, source_name, 'sdnn', sdnn FROM vw_fact_measurements
UNION ALL SELECT measurement_id, measurement_date, source_name, 'rmssd', rmssd FROM vw_fact_measurements
UNION ALL SELECT measurement_id, measurement_date, source_name, 'pNN50', pNN50 FROM vw_fact_measurements
UNION ALL SELECT measurement_id, measurement_date, source_name, 'VLF', VLF FROM vw_fact_measurements
UNION ALL SELECT measurement_id, measurement_date, source_name, 'LF', LF FROM vw_fact_measurements
UNION ALL SELECT measurement_id, measurement_date, source_name, 'HF', HF FROM vw_fact_measurements;

DROP VIEW IF EXISTS vw_latest_baseline_by_source;
CREATE VIEW vw_latest_baseline_by_source AS
SELECT b.*
FROM vw_fact_baselines b
JOIN (
    SELECT source_name, MAX(analysis_date) AS max_analysis_date
    FROM vw_fact_baselines
    GROUP BY source_name
) x
ON b.source_name = x.source_name
AND b.analysis_date = x.max_analysis_date;

DROP VIEW IF EXISTS vw_latest_trends_by_source_metric;
CREATE VIEW vw_latest_trends_by_source_metric AS
SELECT t.*
FROM vw_fact_trends t
JOIN (
    SELECT source_name, metric, MAX(analysis_date) AS max_analysis_date
    FROM vw_fact_trends
    GROUP BY source_name, metric
) x
ON t.source_name = x.source_name
AND t.metric = x.metric
AND t.analysis_date = x.max_analysis_date;
