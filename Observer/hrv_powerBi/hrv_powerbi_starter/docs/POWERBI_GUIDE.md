# Power BI Starter Guide for HRV Platform

## Goal

Build a robust Power BI report from data already stored in `hrv_platform.db`.

## Recommended model

Use these views as your model tables:

Fact tables:
- `vw_fact_measurements`
- `vw_fact_baselines`
- `vw_fact_trends`
- `vw_fact_alerts`
- `vw_fact_anomalies`
- `vw_long_measurements`

Dimensions:
- `vw_dim_date`
- `vw_dim_source`

## Recommended relationships

- `vw_dim_date[date_key]` -> `vw_fact_measurements[measurement_date]`
- `vw_dim_date[date_key]` -> `vw_fact_alerts[alert_date]`
- `vw_dim_date[date_key]` -> `vw_fact_anomalies[measurement_date]`
- `vw_dim_date[date_key]` -> `vw_fact_baselines[analysis_date]`
- `vw_dim_date[date_key]` -> `vw_fact_trends[analysis_date]`
- `vw_dim_source[source_name]` -> all fact tables by `source_name`

## Power BI pages

### 1. Executive Overview
Cards:
- Measurement Count
- Latest MS Score
- Alert Count
- Anomaly Count

Charts:
- RMSSD over time
- SDNN over time
- alerts by metric
- latest anomalies

### 2. Trends
Use `vw_latest_trends_by_source_metric`

### 3. Baseline vs Latest
Use `vw_long_measurements` and latest baseline measures

### 4. Alerts and Anomalies
Use persisted alert and anomaly facts

### 5. Raw Metric Explorer
Line chart of long measurements by metric with slicers

## Setup in Power BI Desktop

1. Open Power BI Desktop.
2. Connect to the SQLite database.
3. Run the SQL in `sql/powerbi_views.sql` first against the DB.
4. Load the views.
5. Create the relationships above.
6. Import the theme.
7. Paste the DAX measures.
8. Build pages using the design above.

Import mode is recommended.
