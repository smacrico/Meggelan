Below is a **Power BI `.pbix` layout spec** you can build drag-and-drop in Desktop for the HRV Analysis Platform. It is designed around your current SQLite views and measures.

Use this as the exact build blueprint for the report pages.

---

# Power BI Layout Spec — HRV Analysis Platform

## 1. Data model required

### Tables / views to load

Core HRV:

* `vw_dim_date`
* `vw_dim_source`
* `vw_fact_measurements`
* `vw_fact_baselines`
* `vw_fact_trends`
* `vw_fact_alerts`
* `vw_fact_anomalies`
* `vw_long_measurements`
* `vw_latest_baseline_by_source`
* `vw_latest_trends_by_source_metric`

MS flare risk:

* `vw_ms_risk_predictions`
* `vw_ms_risk_latest_by_source`

### Relationships

Create these:

* `vw_dim_date[date_key]` -> `vw_fact_measurements[measurement_date]`

* `vw_dim_date[date_key]` -> `vw_fact_alerts[alert_date]`

* `vw_dim_date[date_key]` -> `vw_fact_anomalies[measurement_date]`

* `vw_dim_date[date_key]` -> `vw_fact_baselines[analysis_date]`

* `vw_dim_date[date_key]` -> `vw_fact_trends[analysis_date]`

* `vw_dim_date[date_key]` -> `vw_ms_risk_predictions[prediction_date]`

* `vw_dim_source[source_name]` -> all fact tables by `source_name`

Use single-direction filters.

---

# 2. Report settings

## Canvas

Use **16:9** page size.

Recommended desktop layout:

* Width: standard Power BI widescreen
* Background: white or very light gray
* Visual padding: 12–16 px between visuals

## Global slicers on every page

Place across the top:

* `vw_dim_source[source_name]`
* `vw_dim_date[date_key]`
* `vw_long_measurements[metric]` only on metric pages

Slicer settings:

* Source: dropdown, single select on
* Date: between
* Metric: dropdown, single or multi depending on page

---

# 3. Measure groups to use

## HRV core measures

Use your existing HRV measures from the earlier pack.

## MS risk measures

Use the `measures_ms_risk.dax` file, especially:

* `Latest MS Flare Risk Score`
* `Latest MS Flare Risk Level`
* `Latest HRV Risk Component`
* `Latest Trend Risk Component`
* `Latest Alert Risk Component`
* `Latest Anomaly Risk Component`
* `Latest Symptom Risk Component`
* `Latest Medication Risk Component`
* `Average MS Flare Risk Score`
* `MS Flare Risk 7D Avg`
* `MS Flare Risk 30D Avg`

---

# 4. Page-by-page drag-and-drop layout

---

## PAGE 1 — Executive Overview

### Purpose

One-page operational summary for current status.

### Layout

Top row = slicers
Second row = KPI cards
Third row = HRV trends + MS risk trend
Bottom row = alerts/anomalies

### Visual 1 — Card

**Title:** Measurement Count
**Visual type:** Card
**Field:** `Measurement Count`

### Visual 2 — Card

**Title:** Latest MS Score
**Visual type:** Card
**Field:** `Latest MS Score`

### Visual 3 — Card

**Title:** Latest MS Flare Risk Score
**Visual type:** Card
**Field:** `Latest MS Flare Risk Score`

### Visual 4 — Card

**Title:** Latest MS Flare Risk Level
**Visual type:** Card
**Field:** `Latest MS Flare Risk Level`

### Visual 5 — Card

**Title:** Alert Count
**Visual type:** Card
**Field:** `Alert Count`

### Visual 6 — Card

**Title:** Anomaly Count
**Visual type:** Card
**Field:** `Anomaly Count`

### Visual 7 — Line chart

**Title:** RMSSD and SDNN Over Time
**Visual type:** Line chart
**X-axis:** `vw_dim_date[date_key]`
**Y-axis:**

* `Avg RMSSD`
* `Avg SDNN`

### Visual 8 — Line chart

**Title:** MS Flare Risk Over Time
**Visual type:** Line chart
**X-axis:** `vw_dim_date[date_key]`
**Y-axis:**

* `Average MS Flare Risk Score`
* `MS Flare Risk 7D Avg`
* `MS Flare Risk 30D Avg`

### Visual 9 — Clustered column chart

**Title:** Alerts by Metric
**Visual type:** Clustered column chart
**X-axis:** `vw_fact_alerts[metric]`
**Y-axis:** count of `vw_fact_alerts[alert_id]`

### Visual 10 — Table

**Title:** Latest Anomalies
**Visual type:** Table
**Columns:**

* `vw_fact_anomalies[measurement_date]`
* `vw_fact_anomalies[metric]`
* `vw_fact_anomalies[value]`
* `vw_fact_anomalies[z_score]`
* `vw_fact_anomalies[message]`

---

## PAGE 2 — HRV Trend Diagnostics

### Purpose

Review persisted trend outputs.

### Visual 1 — Matrix

**Title:** Trend Snapshot
**Visual type:** Matrix
**Rows:** `vw_latest_trends_by_source_metric[metric]`
**Values:**

* `vw_latest_trends_by_source_metric[slope]`
* `vw_latest_trends_by_source_metric[r_value]`
* `vw_latest_trends_by_source_metric[p_value]`
* `vw_latest_trends_by_source_metric[trend_direction]`
* `vw_latest_trends_by_source_metric[trend_strength]`
* `vw_latest_trends_by_source_metric[latest_ms_score]`

### Visual 2 — Bar chart

**Title:** Trend Slope by Metric
**Visual type:** Clustered bar chart
**Y-axis:** `vw_latest_trends_by_source_metric[metric]`
**X-axis:** `Trend Slope`

### Visual 3 — Scatter chart

**Title:** Trend Strength vs Slope
**Visual type:** Scatter chart
**X-axis:** `Trend R Value`
**Y-axis:** `Trend Slope`
**Details:** `vw_latest_trends_by_source_metric[metric]`
**Tooltips:**

* `vw_latest_trends_by_source_metric[trend_direction]`
* `vw_latest_trends_by_source_metric[trend_strength]`
* `vw_latest_trends_by_source_metric[latest_ms_score]`

### Visual 4 — Table

**Title:** Trend Detail
**Visual type:** Table
**Columns:**

* `metric`
* `mean`
* `std`
* `min`
* `max`
* `trend_direction`
* `trend_strength`

---

## PAGE 3 — Baseline vs Latest

### Purpose

Compare the newest HRV state to the latest baseline snapshot.

### Visual 1 — Clustered column chart

**Title:** Latest vs Baseline by Metric
**Visual type:** Clustered column chart
**X-axis:** `vw_long_measurements[metric]`
**Values:**

* `Latest Metric Value`
* `Baseline Avg`

### Visual 2 — Table

**Title:** Baseline Deviation Table
**Visual type:** Table
**Rows:** `vw_long_measurements[metric]`
**Values:**

* `Latest Metric Value`
* `Baseline Avg`
* `Baseline Std`
* `Deviation vs Baseline %`
* `Z Score vs Baseline`
* `Metric Status`

Use conditional formatting on:

* `Deviation vs Baseline %`
* `Z Score vs Baseline`
* `Metric Status`

### Visual 3 — Matrix

**Title:** Metric Status Heatmap
**Visual type:** Matrix
**Rows:** `vw_long_measurements[metric]`
**Values:**

* `Deviation vs Baseline %`
* `Z Score vs Baseline`

Apply background conditional formatting.

---

## PAGE 4 — Alerts & Anomalies

### Purpose

Operational event monitoring.

### Visual 1 — Line chart

**Title:** Alert and Anomaly Burden
**Visual type:** Line chart
**X-axis:** `vw_dim_date[date_key]`
**Y-axis:**

* count of `vw_fact_alerts[alert_id]`
* count of `vw_fact_anomalies[anomaly_id]`

### Visual 2 — Clustered column chart

**Title:** Anomalies by Metric
**Visual type:** Clustered column chart
**X-axis:** `vw_fact_anomalies[metric]`
**Y-axis:** count of `vw_fact_anomalies[anomaly_id]`

### Visual 3 — Table

**Title:** Alert Log
**Visual type:** Table
**Columns:**

* `vw_fact_alerts[alert_date]`
* `vw_fact_alerts[metric]`
* `vw_fact_alerts[current_value]`
* `vw_fact_alerts[baseline_value]`
* `vw_fact_alerts[deviation_pct]`
* `vw_fact_alerts[alert_message]`

### Visual 4 — Table

**Title:** Anomaly Log
**Visual type:** Table
**Columns:**

* `vw_fact_anomalies[measurement_date]`
* `vw_fact_anomalies[metric]`
* `vw_fact_anomalies[value]`
* `vw_fact_anomalies[baseline_mean]`
* `vw_fact_anomalies[baseline_std]`
* `vw_fact_anomalies[z_score]`
* `vw_fact_anomalies[message]`

---

## PAGE 5 — Raw Metric Explorer

### Purpose

Analyst-grade raw measurement exploration.

### Visual 1 — Line chart

**Title:** Long Measurements by Metric
**Visual type:** Line chart
**X-axis:** `vw_dim_date[date_key]`
**Y-axis:** average of `vw_long_measurements[value]`
**Legend:** `vw_long_measurements[metric]`

### Visual 2 — Table

**Title:** Raw Measurement Detail
**Visual type:** Table
**Columns:**

* `vw_long_measurements[measurement_date]`
* `vw_long_measurements[source_name]`
* `vw_long_measurements[metric]`
* `vw_long_measurements[value]`

### Visual 3 — Optional small multiples line chart

**Title:** Metric Small Multiples
**Visual type:** Line chart with small multiples
**X-axis:** `vw_dim_date[date_key]`
**Y-axis:** average of `vw_long_measurements[value]`
**Small multiples:** `vw_long_measurements[metric]`

---

## PAGE 6 — Baseline History

### Purpose

Track whether the baseline itself is shifting.

### Visual 1 — Line chart

**Title:** Baseline Means Over Time
**Visual type:** Line chart
**X-axis:** `vw_fact_baselines[analysis_date]`
**Y-axis:**

* `vw_fact_baselines[avg_rmssd]`
* `vw_fact_baselines[avg_sdnn]`
* `vw_fact_baselines[avg_HF]`
* `vw_fact_baselines[avg_LF]`

### Visual 2 — Line chart

**Title:** Baseline Std Over Time
**Visual type:** Line chart
**X-axis:** `vw_fact_baselines[analysis_date]`
**Y-axis:**

* `vw_fact_baselines[std_rmssd]`
* `vw_fact_baselines[std_sdnn]`
* `vw_fact_baselines[std_HF]`
* `vw_fact_baselines[std_LF]`

### Visual 3 — Table

**Title:** Baseline Snapshot Detail
**Visual type:** Table
**Columns:**

* `analysis_date`
* `source_name`
* all `avg_*`
* all `std_*`

---

## PAGE 7 — MS Flare Risk

### Purpose

Dedicated flare-risk analytics page.

### Visual 1 — Card

**Title:** Latest MS Flare Risk Score
**Field:** `Latest MS Flare Risk Score`

### Visual 2 — Card

**Title:** Latest MS Flare Risk Level
**Field:** `Latest MS Flare Risk Level`

### Visual 3 — Card

**Title:** Latest Prediction Timestamp
**Field:** `Latest MS Flare Prediction Timestamp`

### Visual 4 — Line chart

**Title:** MS Flare Risk Trend
**Visual type:** Line chart
**X-axis:** `vw_dim_date[date_key]`
**Y-axis:**

* `Average MS Flare Risk Score`
* `MS Flare Risk 7D Avg`
* `MS Flare Risk 30D Avg`

### Visual 5 — Clustered bar chart

**Title:** Latest Risk Component Breakdown
**Visual type:** Clustered bar chart

Build this one manually with six measures:

* `Latest HRV Risk Component`
* `Latest Trend Risk Component`
* `Latest Alert Risk Component`
* `Latest Anomaly Risk Component`
* `Latest Symptom Risk Component`
* `Latest Medication Risk Component`

In Power BI this is easiest by using a disconnected helper table or by making six cards.
For the simplest drag-drop version, use **six cards** instead:

* Card: `Latest HRV Risk Component`
* Card: `Latest Trend Risk Component`
* Card: `Latest Alert Risk Component`
* Card: `Latest Anomaly Risk Component`
* Card: `Latest Symptom Risk Component`
* Card: `Latest Medication Risk Component`

### Visual 6 — Stacked column chart

**Title:** Historical Component Burden
**Visual type:** Stacked column chart
**X-axis:** `vw_dim_date[date_key]`
**Y-axis:**

* `Avg HRV Risk Component`
* `Avg Trend Risk Component`
* `Avg Alert Risk Component`
* `Avg Anomaly Risk Component`
* `Avg Symptom Risk Component`
* `Avg Medication Risk Component`

### Visual 7 — Table

**Title:** Risk History
**Visual type:** Table
**Columns:**

* `vw_ms_risk_predictions[prediction_timestamp]`
* `vw_ms_risk_predictions[source_name]`
* `vw_ms_risk_predictions[overall_risk_score]`
* `vw_ms_risk_predictions[risk_level]`
* `vw_ms_risk_predictions[hrv_component]`
* `vw_ms_risk_predictions[trend_component]`
* `vw_ms_risk_predictions[alert_component]`
* `vw_ms_risk_predictions[anomaly_component]`
* `vw_ms_risk_predictions[symptom_component]`
* `vw_ms_risk_predictions[medication_component]`

### Visual 8 — Table or multi-row card

**Title:** Latest Recommendations
**Field:** `Latest MS Risk Recommendations`

### Visual 9 — Table or multi-row card

**Title:** Latest Data Quality Notes
**Field:** `Latest MS Risk Data Quality Notes`

---

## PAGE 8 — Quality Control / Data Freshness

### Purpose

Validate the pipeline is updating correctly.

### Visual 1 — Card

**Title:** Latest Measurement Date
**Field:** `Latest Measurement Date`

### Visual 2 — Card

**Title:** Measurement Count
**Field:** `Measurement Count`

### Visual 3 — Card

**Title:** MS Risk Prediction Count
**Field:** `MS Risk Prediction Count`

### Visual 4 — Table

**Title:** Latest Trend Snapshot
**Source:** `vw_latest_trends_by_source_metric`
**Columns:**

* `metric`
* `analysis_date`
* `slope`
* `r_value`
* `trend_direction`
* `trend_strength`

### Visual 5 — Table

**Title:** Latest Baseline Snapshot
**Source:** `vw_latest_baseline_by_source`

### Visual 6 — Bar chart

**Title:** Records by Source
**Visual type:** Bar chart
**Axis:** `vw_dim_source[source_name]`
**Values:** `Measurement Count`

---

# 5. Formatting guidance

## Cards

* Category label on
* Callout value large
* Consistent width/height across each row

## Tables

* Turn on search where useful
* Enable conditional formatting on risk and z-score fields

## Line charts

* Use clean date axis
* Turn off excessive background clutter
* Keep legend on top or right

## Risk thresholds

For conditional formatting:

* Low: 0.00–0.30
* Moderate: 0.31–0.60
* High: 0.61–0.80
* Critical: 0.81–1.00

Apply these to:

* overall risk score
* component measures
* deviation / z-score tables

---

# 6. Build order in Power BI

## Step 1

Load all views/tables.

## Step 2

Create relationships.

## Step 3

Add all DAX measures:

* HRV core
* MS risk measures

## Step 4

Build Page 1 first:

* cards
* 2 line charts
* anomaly table

## Step 5

Build Pages 2–4:

* trends
* baseline
* alerts/anomalies

## Step 6

Build Page 7:

* MS flare risk page

## Step 7

Build Page 8:

* QC/freshness

---

# 7. Optional helper table for component bar chart

If you want the **latest component breakdown** as a real bar chart rather than six cards, create a disconnected table:

```DAX
MS Risk Component Names =
DATATABLE(
    "Component", STRING,
    {
        {"HRV"},
        {"Trend"},
        {"Alerts"},
        {"Anomalies"},
        {"Symptoms"},
        {"Medication"}
    }
)
```

Then create measure:

```DAX
Latest MS Risk Component Value =
SWITCH(
    SELECTEDVALUE('MS Risk Component Names'[Component]),
    "HRV", [Latest HRV Risk Component],
    "Trend", [Latest Trend Risk Component],
    "Alerts", [Latest Alert Risk Component],
    "Anomalies", [Latest Anomaly Risk Component],
    "Symptoms", [Latest Symptom Risk Component],
    "Medication", [Latest Medication Risk Component]
)
```

Then use:

* Axis: `MS Risk Component Names[Component]`
* Value: `Latest MS Risk Component Value`

That gives you a clean drag-drop bar chart.

---

If you want, I can turn this into a **copy-paste build checklist** with page names, visual names, and exact field assignments in compact form for faster implementation.
