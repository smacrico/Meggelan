# Full Page-by-Page Visual Layout

## Report-level slicers
Place at top-right on every page:
- Source Name
- Date range
- Metric (where applicable)

---

## Page 1 — Executive Overview

### Canvas intent
Single-page leadership summary.

### Top row cards
1. Measurement Count
2. Latest MS Score
3. Alert Count
4. Anomaly Count

### Middle-left
Line chart:
- Axis: `vw_dim_date[date_key]`
- Values: `Avg RMSSD`, `Avg SDNN`
- Secondary option: separate visuals if needed

### Middle-right
KPI / line chart:
- Axis: `vw_dim_date[date_key]`
- Value: `Latest MS Score` or `MS Score 7D Avg`

### Bottom-left
Clustered column chart:
- Axis: `vw_fact_alerts[metric]`
- Value: count of alerts

### Bottom-right
Table:
- measurement_date
- metric
- value
- z_score
- message
Source: `vw_fact_anomalies`

Narrative goal:
Show overall signal, whether risk is rising, and where the immediate problems are.

---

## Page 2 — Trend Diagnostics

### Left panel
Matrix from `vw_latest_trends_by_source_metric`:
- metric
- slope
- r_value
- p_value
- trend_direction
- trend_strength

### Top-right
Bar chart:
- Axis: metric
- Value: Trend Slope

### Bottom-right
Scatter plot:
- X: Trend R Value
- Y: Trend Slope
- Legend: metric
- Tooltip: trend_direction, trend_strength, latest_ms_score

Narrative goal:
Identify which metrics are improving, declining, and how strong that signal is.

---

## Page 3 — Baseline vs Latest

### Top
Clustered bar chart:
- Axis: metric from `vw_long_measurements`
- Values:
  - Latest Metric Value
  - Baseline Avg

### Bottom-left
Table:
- metric
- Latest Metric Value
- Baseline Avg
- Baseline Std
- Deviation vs Baseline %
- Z Score vs Baseline
- Metric Status

### Bottom-right
Heatmap-style matrix or conditional formatted table:
- Rows: metric
- Columns: status/deviation fields
- Conditional formatting by `Metric Status` and absolute z-score

Narrative goal:
Answer “How far away from baseline are we right now?”

---

## Page 4 — Alerts & Anomalies

### Top-left
Line chart:
- Axis: `vw_dim_date[date_key]`
- Values:
  - Alert Count
  - Anomaly Count

### Top-right
Bar chart:
- Axis: metric
- Value: count of anomalies

### Bottom-left
Table from `vw_fact_alerts`:
- alert_date
- metric
- current_value
- baseline_value
- deviation_pct
- alert_message

### Bottom-right
Table from `vw_fact_anomalies`:
- measurement_date
- metric
- value
- baseline_mean
- baseline_std
- z_score
- message

Narrative goal:
Give operators the event log and where intervention is needed.

---

## Page 5 — Raw Metric Explorer

### Main visual
Line chart:
- Axis: `vw_dim_date[date_key]`
- Value: average of `vw_long_measurements[value]`
- Legend: `vw_long_measurements[metric]`

### Supporting visuals
- Small multiples by metric, or
- Separate line charts for RMSSD, SDNN, HF, LF

### Right-side detail table
- measurement_date
- metric
- value
- source_name

Narrative goal:
Provide analyst-grade drill-through into raw metric history.

---

## Page 6 — Baseline History

### Top
Line chart:
- Axis: `vw_fact_baselines[analysis_date]`
- Values:
  - avg_rmssd
  - avg_sdnn
  - avg_HF
  - avg_LF

### Bottom
Line chart or table:
- Axis: analysis_date
- Values:
  - std_rmssd
  - std_sdnn
  - std_HF
  - std_LF

Narrative goal:
Track whether the baseline itself is drifting over time.

---

## Page 7 — Snapshot Quality Control

### Cards
- Latest Measurement Date
- Measurement Count
- Alert Rate %
- Anomaly Rate %

### Tables
- latest baseline rows
- latest trend rows
- source list

### Diagnostics
Bar chart by weekday or month using `vw_dim_date`

Narrative goal:
Validate ingestion quality and report freshness.

## Visual styling guidance

- Use consistent card widths across the top row
- Keep line charts on a white canvas with light gridlines
- Use conditional formatting for alert/anomaly tables
- Prefer source slicer as single-select by default
- Prefer date slicer as between/range
- Keep page titles concise and action-oriented
