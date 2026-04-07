# Star Schema Plan

## Fact tables

### 1. FactTrainingLogs
Source: `vw_fact_training_logs`
Grain: one row per training session after Python calculations

Use for:
- TRIMP
- recovery / readiness
- speed metrics
- HR-RS deviation
- fatigue
- pace
- efficiency trends

### 2. FactRunningSessions
Source: `vw_fact_running_sessions`
Grain: one row per raw running session

Use for:
- validation
- raw source comparisons
- simpler operational visuals

### 3. FactMonthlySummaries
Source: `vw_fact_monthly_summaries`
Grain: one row per month

Use for:
- monthly KPI trend pages
- stable executive summaries
- trend cards

### 4. FactMetricsBreakdown
Source: `vw_fact_metrics_breakdown`
Grain: one row per model/scoring snapshot date

Use for:
- overall score tracking
- weighted contribution visuals
- diagnostic score analysis

## Dimensions

### DimDate
Source: `vw_dim_date`
Key: `date`

### DimSpeedZone
Source: `vw_dim_speed_zone`
Key: `speed_zone`

### DimRiskLevel
You can either:
- create this in Power BI as a small entered table, or
- extend SQL if risk is persisted later

## Relationships

- `DimDate[date]` -> `FactTrainingLogs[session_date]` (1:* single direction)
- `DimDate[date]` -> `FactRunningSessions[session_date]` (1:*)
- `DimDate[year_month]` -> `FactMonthlySummaries[year_month]` (1:*)
- `DimDate[date]` -> `FactMetricsBreakdown[snapshot_date]` (1:*)
- `DimSpeedZone[speed_zone]` -> `FactTrainingLogs[speed_zone]` (1:*)
- `DimSpeedZone[speed_zone]` -> `FactRunningSessions[speed_zone]` (1:*)

## Modeling recommendations

- Mark `DimDate` as the official date table
- Hide raw keys from report view
- Create a dedicated `Measures` table in Power BI
- Prefer single-direction relationships
- Keep `FactRunningSessions` mostly hidden unless needed for validation
- Use `FactTrainingLogs` as the main semantic fact table

## Suggested semantic focus

Primary report fact:
- `FactTrainingLogs`

Secondary facts:
- `FactMonthlySummaries`
- `FactMetricsBreakdown`

Operational/raw support:
- `FactRunningSessions`
