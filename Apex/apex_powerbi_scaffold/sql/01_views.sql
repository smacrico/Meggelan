-- Apex Power BI SQL Views
-- Run against Apex.db

DROP VIEW IF EXISTS vw_fact_running_sessions;
CREATE VIEW vw_fact_running_sessions AS
SELECT
    rowid AS session_key,
    date(date) AS session_date,
    CAST(strftime('%Y', date) AS INTEGER) AS year,
    CAST(strftime('%m', date) AS INTEGER) AS month_number,
    strftime('%Y-%m', date) AS year_month,
    CAST(strftime('%W', date) AS INTEGER) AS week_number,
    running_economy,
    vo2max,
    distance,
    time AS duration_min,
    heart_rate,
    avg_speed,
    max_speed,
    COALESCE(HR_RS_Deviation_Index, 0) AS hr_rs_deviation,
    COALESCE(cardiacdrift, 0) AS cardiac_drift,
    CASE
        WHEN avg_speed < 10 THEN 'Slow'
        WHEN avg_speed >= 10 AND avg_speed < 14 THEN 'Moderate'
        WHEN avg_speed >= 14 THEN 'Fast'
        ELSE 'Unknown'
    END AS speed_zone
FROM running_sessions;

DROP VIEW IF EXISTS vw_fact_training_logs;
CREATE VIEW vw_fact_training_logs AS
SELECT
    rowid AS training_log_key,
    date(date) AS session_date,
    CAST(strftime('%Y', date) AS INTEGER) AS year,
    CAST(strftime('%m', date) AS INTEGER) AS month_number,
    strftime('%Y-%m', date) AS year_month,
    running_economy,
    vo2max,
    distance,
    time,
    heart_rate,
    avg_speed,
    max_speed,
    hr_rs_deviation,
    cardiac_drift,
    efficiency_score,
    energy_cost,
    duration_min,
    duration_hr,
    hr_ratio,
    TRIMP,
    physio_efficiency,
    fatigue_index,
    speed_reserve,
    speed_consistency,
    pace_per_km,
    speed_efficiency,
    economy_at_speed,
    speed_vo2max_index,
    recovery_score,
    readiness_score,
    CASE
        WHEN avg_speed < 10 THEN 'Slow'
        WHEN avg_speed >= 10 AND avg_speed < 14 THEN 'Moderate'
        WHEN avg_speed >= 14 THEN 'Fast'
        ELSE 'Unknown'
    END AS speed_zone
FROM training_logs;

DROP VIEW IF EXISTS vw_fact_monthly_summaries;
CREATE VIEW vw_fact_monthly_summaries AS
SELECT
    year_month,
    CAST(substr(year_month, 1, 4) AS INTEGER) AS year,
    CAST(substr(year_month, 6, 2) AS INTEGER) AS month_number,
    sessions,
    running_economy_mean,
    running_economy_std,
    vo2max_mean,
    vo2max_std,
    distance_mean,
    distance_std,
    efficiency_score_mean,
    efficiency_score_std,
    heart_rate_mean,
    heart_rate_std,
    energy_cost_mean,
    energy_cost_std,
    trimp_mean,
    trimp_std,
    recovery_score_mean,
    recovery_score_std,
    readiness_score_mean,
    readiness_score_std,
    avg_speed_mean,
    avg_speed_std,
    max_speed_mean,
    max_speed_std,
    speed_reserve_mean,
    speed_reserve_std,
    hr_rs_deviation_mean,
    hr_rs_deviation_std,
    speed_efficiency_mean,
    speed_efficiency_std
FROM monthly_summaries;

DROP VIEW IF EXISTS vw_fact_metrics_breakdown;
CREATE VIEW vw_fact_metrics_breakdown AS
SELECT
    id AS metrics_breakdown_key,
    date(date) AS snapshot_date,
    overall_score,
    running_economy_normalized,
    running_economy_weighted,
    running_economy_raw_mean,
    running_economy_raw_std,
    vo2max_normalized,
    vo2max_weighted,
    vo2max_raw_mean,
    vo2max_raw_std,
    distance_normalized,
    distance_weighted,
    distance_raw_mean,
    distance_raw_std,
    efficiency_score_normalized,
    efficiency_score_weighted,
    efficiency_score_raw_mean,
    efficiency_score_raw_std,
    heart_rate_normalized,
    heart_rate_weighted,
    heart_rate_raw_mean,
    heart_rate_raw_std,
    running_economy_trend,
    distance_progression,
    avg_speed_mean,
    avg_speed_std,
    max_speed_mean,
    max_speed_std,
    speed_reserve_mean,
    speed_reserve_std,
    speed_consistency_mean,
    speed_consistency_std,
    pace_per_km_mean,
    pace_per_km_std,
    speed_efficiency_mean,
    speed_efficiency_std,
    economy_at_speed_mean,
    economy_at_speed_std,
    speed_vo2max_index_mean,
    speed_vo2max_index_std,
    hr_rs_deviation_mean,
    hr_rs_deviation_std,
    cardiac_drift_mean,
    cardiac_drift_std,
    physio_efficiency_mean,
    physio_efficiency_std,
    fatigue_index_mean,
    fatigue_index_std
FROM metrics_breakdown;

DROP VIEW IF EXISTS vw_dim_date;
CREATE VIEW vw_dim_date AS
WITH RECURSIVE dates(d) AS (
    SELECT (
        SELECT MIN(session_date)
        FROM (
            SELECT date(date) AS session_date FROM running_sessions
            UNION ALL
            SELECT date(date) AS session_date FROM training_logs
            UNION ALL
            SELECT date(date) AS session_date FROM metrics_breakdown
        )
    )
    UNION ALL
    SELECT date(d, '+1 day')
    FROM dates
    WHERE d < (
        SELECT MAX(session_date)
        FROM (
            SELECT date(date) AS session_date FROM running_sessions
            UNION ALL
            SELECT date(date) AS session_date FROM training_logs
            UNION ALL
            SELECT date(date) AS session_date FROM metrics_breakdown
        )
    )
)
SELECT
    d AS date,
    CAST(strftime('%Y', d) AS INTEGER) AS year,
    CAST(strftime('%m', d) AS INTEGER) AS month_number,
    CAST(strftime('%d', d) AS INTEGER) AS day_of_month,
    strftime('%Y-%m', d) AS year_month,
    strftime('%Y-Q') ||
        CASE
            WHEN CAST(strftime('%m', d) AS INTEGER) BETWEEN 1 AND 3 THEN '1'
            WHEN CAST(strftime('%m', d) AS INTEGER) BETWEEN 4 AND 6 THEN '2'
            WHEN CAST(strftime('%m', d) AS INTEGER) BETWEEN 7 AND 9 THEN '3'
            ELSE '4'
        END AS year_quarter,
    CASE strftime('%w', d)
        WHEN '0' THEN 'Sunday'
        WHEN '1' THEN 'Monday'
        WHEN '2' THEN 'Tuesday'
        WHEN '3' THEN 'Wednesday'
        WHEN '4' THEN 'Thursday'
        WHEN '5' THEN 'Friday'
        ELSE 'Saturday'
    END AS weekday_name,
    CASE
        WHEN CAST(strftime('%m', d) AS INTEGER) IN (12, 1, 2) THEN 'Winter'
        WHEN CAST(strftime('%m', d) AS INTEGER) IN (3, 4, 5) THEN 'Spring'
        WHEN CAST(strftime('%m', d) AS INTEGER) IN (6, 7, 8) THEN 'Summer'
        ELSE 'Autumn'
    END AS season
FROM dates;

DROP VIEW IF EXISTS vw_dim_speed_zone;
CREATE VIEW vw_dim_speed_zone AS
SELECT 'Slow' AS speed_zone, 1 AS zone_sort
UNION ALL SELECT 'Moderate', 2
UNION ALL SELECT 'Fast', 3
UNION ALL SELECT 'Unknown', 4;

DROP VIEW IF EXISTS vw_dim_risk_level;
CREATE VIEW vw_dim_risk_level AS
SELECT 'Low' AS risk_level, 1 AS risk_sort
UNION ALL SELECT 'Medium', 2
UNION ALL SELECT 'High', 3
UNION ALL SELECT 'Unknown', 4;
