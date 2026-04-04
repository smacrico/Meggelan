Here’s a **field mapping checklist** you can use while building the Power BI report.

---

# Power BI Field Mapping Checklist

## Global slicers

Use on most pages:

### Source slicer

* Table: `vw_dim_source`
* Field: `source_name`

### Date slicer

* Table: `vw_dim_date`
* Field: `date_key`

### Metric slicer

Use only on metric-focused pages.

* Table: `vw_long_measurements`
* Field: `metric`

---

# Page 1 — Executive Overview

## Card: Measurement Count

* Visual: Card
* Measure: `Measurement Count`

## Card: Latest MS Score

* Visual: Card
* Measure: `Latest MS Score`

## Card: Alert Count

* Visual: Card
* Measure: `Alert Count`

## Card: Anomaly Count

* Visual: Card
* Measure: `Anomaly Count`

## Line chart: RMSSD + SDNN over time

* Visual: Line chart
* X-axis: `vw_dim_date[date_key]`
* Y-axis:

  * `Avg RMSSD`
  * `Avg SDNN`

## KPI or line chart: MS Score over time

Recommended if you create a time-series measure/table later. For the starter:

* Visual: Card or line chart
* Value: `Latest MS Score`
* Optional X-axis: `vw_dim_date[date_key]`

## Column chart: Alerts by metric

* Visual: Clustered column chart
* Axis: `vw_fact_alerts[metric]`
* Values: count of `vw_fact_alerts[alert_id]`

## Table: Latest anomalies

* Visual: Table
* Columns:

  * `vw_fact_anomalies[measurement_date]`
  * `vw_fact_anomalies[metric]`
  * `vw_fact_anomalies[value]`
  * `vw_fact_anomalies[z_score]`
  * `vw_fact_anomalies[message]`

---

# Page 2 — Trend Diagnostics

## Matrix: trend snapshot

* Visual: Matrix
* Rows: `vw_latest_trends_by_source_metric[metric]`
* Values:

  * `vw_latest_trends_by_source_metric[slope]`
  * `vw_latest_trends_by_source_metric[r_value]`
  * `vw_latest_trends_by_source_metric[p_value]`
  * `vw_latest_trends_by_source_metric[trend_direction]`
  * `vw_latest_trends_by_source_metric[trend_strength]`

## Bar chart: slope by metric

* Visual: Clustered bar chart
* Axis: `vw_latest_trends_by_source_metric[metric]`
* Values: `Trend Slope`

## Scatter: r_value vs slope

* Visual: Scatter chart
* X-axis: `Trend R Value`
* Y-axis: `Trend Slope`
* Details: `vw_latest_trends_by_source_metric[metric]`
* Tooltips:

  * `vw_latest_trends_by_source_metric[trend_direction]`
  * `vw_latest_trends_by_source_metric[trend_strength]`
  * `vw_latest_trends_by_source_metric[latest_ms_score]`

---

# Page 3 — Baseline vs Latest

## Clustered bar: latest vs baseline

* Visual: Clustered column or bar chart
* Axis: `vw_long_measurements[metric]`
* Values:

  * `Latest Metric Value`
  * `Baseline Avg`

## Table: deviation / z-score / status

* Visual: Table
* Rows: `vw_long_measurements[metric]`
* Values:

  * `Latest Metric Value`
  * `Baseline Avg`
  * `Baseline Std`
  * `Deviation vs Baseline %`
  * `Z Score vs Baseline`
  * `Metric Status`

## Heatmap-style matrix

* Visual: Matrix
* Rows: `vw_long_measurements[metric]`
* Values:

  * `Deviation vs Baseline %`
  * `Z Score vs Baseline`
* Formatting:

  * conditional formatting by absolute deviation or z-score

---

# Page 4 — Alerts & Anomalies

## Line chart: alert and anomaly counts over time

* Visual: Line chart
* X-axis: `vw_dim_date[date_key]`
* Y-axis:

  * count of `vw_fact_alerts[alert_id]`
  * count of `vw_fact_anomalies[anomaly_id]`

## Bar chart: anomalies by metric

* Visual: Clustered column chart
* Axis: `vw_fact_anomalies[metric]`
* Values: count of `vw_fact_anomalies[anomaly_id]`

## Table: alerts log

* Visual: Table
* Columns:

  * `vw_fact_alerts[alert_date]`
  * `vw_fact_alerts[metric]`
  * `vw_fact_alerts[current_value]`
  * `vw_fact_alerts[baseline_value]`
  * `vw_fact_alerts[deviation_pct]`
  * `vw_fact_alerts[alert_message]`

## Table: anomalies log

* Visual: Table
* Columns:

  * `vw_fact_anomalies[measurement_date]`
  * `vw_fact_anomalies[metric]`
  * `vw_fact_anomalies[value]`
  * `vw_fact_anomalies[baseline_mean]`
  * `vw_fact_anomalies[baseline_std]`
  * `vw_fact_anomalies[z_score]`
  * `vw_fact_anomalies[message]`

---

# Page 5 — Raw Metric Explorer

## Line chart: raw values by metric

* Visual: Line chart
* X-axis: `vw_dim_date[date_key]`
* Y-axis: average of `vw_long_measurements[value]`
* Legend: `vw_long_measurements[metric]`

## Detail table

* Visual: Table
* Columns:

  * `vw_long_measurements[measurement_date]`
  * `vw_long_measurements[source_name]`
  * `vw_long_measurements[metric]`
  * `vw_long_measurements[value]`

## Optional small multiples

* Visual: Small multiples line chart
* X-axis: `vw_dim_date[date_key]`
* Y-axis: average of `vw_long_measurements[value]`
* Small multiples: `vw_long_measurements[metric]`

---

# Page 6 — Baseline History

## Line chart: baseline averages over time

* Visual: Line chart
* X-axis: `vw_fact_baselines[analysis_date]`
* Y-axis:

  * `vw_fact_baselines[avg_rmssd]`
  * `vw_fact_baselines[avg_sdnn]`
  * `vw_fact_baselines[avg_HF]`
  * `vw_fact_baselines[avg_LF]`

## Line chart: baseline standard deviations over time

* Visual: Line chart
* X-axis: `vw_fact_baselines[analysis_date]`
* Y-axis:

  * `vw_fact_baselines[std_rmssd]`
  * `vw_fact_baselines[std_sdnn]`
  * `vw_fact_baselines[std_HF]`
  * `vw_fact_baselines[std_LF]`

## Baseline snapshot table

* Visual: Table
* Columns:

  * `vw_fact_baselines[analysis_date]`
  * `vw_fact_baselines[source_name]`
  * all `avg_*`
  * all `std_*`

---

# Page 7 — Snapshot Quality Control

## Card: Latest Measurement Date

* Visual: Card
* Measure: `Latest Measurement Date`

## Card: Measurement Count

* Visual: Card
* Measure: `Measurement Count`

## Card: Alert Rate %

* Visual: Card
* Measure: `Alert Rate %`

## Card: Anomaly Rate %

* Visual: Card
* Measure: `Anomaly Rate %`

## Table: latest baselines

* Visual: Table
* Source: `vw_latest_baseline_by_source`
* Suggested columns:

  * `analysis_date`
  * `source_name`
  * `avg_rmssd`
  * `avg_sdnn`
  * `avg_HF`
  * `avg_LF`

## Table: latest trends

* Visual: Table
* Source: `vw_latest_trends_by_source_metric`
* Suggested columns:

  * `metric`
  * `slope`
  * `r_value`
  * `trend_direction`
  * `trend_strength`
  * `latest_ms_score`

## Source coverage chart

* Visual: Bar chart
* Axis: `vw_dim_source[source_name]`
* Values: `Measurement Count`

---

# Model checklist

## Load these tables/views

* `vw_fact_measurements`
* `vw_fact_baselines`
* `vw_fact_trends`
* `vw_fact_alerts`
* `vw_fact_anomalies`
* `vw_long_measurements`
* `vw_latest_baseline_by_source`
* `vw_latest_trends_by_source_metric`
* `vw_dim_date`
* `vw_dim_source`

## Relationships

* `vw_dim_date[date_key]` -> `vw_fact_measurements[measurement_date]`
* `vw_dim_date[date_key]` -> `vw_fact_alerts[alert_date]`
* `vw_dim_date[date_key]` -> `vw_fact_anomalies[measurement_date]`
* `vw_dim_date[date_key]` -> `vw_fact_baselines[analysis_date]`
* `vw_dim_date[date_key]` -> `vw_fact_trends[analysis_date]`
* `vw_dim_source[source_name]` -> all fact tables by `source_name`

## Measures to create

* `Measurement Count`
* `Alert Count`
* `Anomaly Count`
* `Latest Measurement Date`
* `Avg RMSSD`
* `Avg SDNN`
* `Avg HF`
* `Avg LF`
* `Latest MS Score`
* `Latest Metric Value`
* `Baseline Avg`
* `Baseline Std`
* `Deviation vs Baseline %`
* `Z Score vs Baseline`
* `Trend Slope`
* `Trend R Value`
* `Trend Direction`
* `Trend Strength`
* `RMSSD 7D Avg`
* `SDNN 7D Avg`
* `MS Score 7D Avg`
* `Alert Rate %`
* `Anomaly Rate %`
* `Metric Status`

---

# Build order checklist

## First

* import theme
* load views
* create relationships

## Next

* create DAX measures

## Then

* Page 1 cards and top-level trends
* Page 2 trend diagnostics
* Page 3 baseline comparison
* Page 4 event tables
* Page 5 raw explorer
* Page 6 baseline history
* Page 7 quality control

If you want, I can turn this into a downloadable checklist file for the starter pack.
