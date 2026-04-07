# Page-by-Page Power BI Report Design

## Page 1 — Executive Overview
Purpose: quick read for status and trend

Visuals:
- KPI cards:
  - Sessions
  - Total Distance KM
  - Total TRIMP
  - Average Avg Speed
  - Average Recovery Score
  - Overall Score Latest
- Line chart: Distance KM by Month
- Line chart: Total TRIMP by Month
- Clustered column: Average Avg Speed by Month
- Ribbon or line chart: Average Recovery Score and Average Readiness Score by Month
- Slicers:
  - Date
  - Speed Zone

## Page 2 — Training Load
Purpose: understand workload and balance

Visuals:
- KPI cards:
  - Total TRIMP
  - Average TRIMP
  - ACWR Approx
  - ACWR Risk Band
- Line chart: TRIMP by Session Date
- Area/line combo: Distance and TRIMP over time
- Matrix: Month -> Sessions / Distance / TRIMP
- Gauge:
  - ACWR Approx
  - green target band 0.8–1.3
- Scatter:
  - TRIMP vs Avg Speed

## Page 3 — Performance
Purpose: show performance progression

Visuals:
- KPI cards:
  - Average Running Economy
  - Average VO2max
  - Average Pace Per KM
  - Average Avg Speed
- Line chart: Running Economy by Session Date
- Line chart: VO2max by Session Date
- Line chart: Pace Per KM by Session Date
- Scatter:
  - Avg Speed vs Heart Rate
- Scatter:
  - Running Economy vs Heart Rate
- Column chart:
  - Speed Zone Distribution

## Page 4 — Recovery & Readiness
Purpose: athlete freshness and readiness

Visuals:
- KPI cards:
  - Average Recovery Score
  - Average Readiness Score
  - Last Session Recovery
  - Last Session Readiness
- Line chart:
  - Recovery Score
  - Readiness Score
- Histogram or column bins:
  - Recovery Score distribution
- Histogram or column bins:
  - Readiness Score distribution
- Table:
  - Session Date
  - TRIMP
  - Recovery Score
  - Readiness Score

## Page 5 — Speed & Efficiency
Purpose: detailed pace/speed analysis

Visuals:
- KPI cards:
  - Average Avg Speed
  - Average Max Speed
  - Average Speed Reserve
  - Average Speed Efficiency
- Line chart:
  - Avg Speed and Max Speed over time
- Line chart:
  - Pace Per KM over time
- Scatter:
  - Speed Efficiency vs Heart Rate
- Scatter:
  - Economy At Speed vs Avg Speed
- Bar chart:
  - Speed Zone distribution
- Table:
  - Session Date
  - Avg Speed
  - Max Speed
  - Pace Per KM
  - Speed Reserve
  - Speed Efficiency

## Page 6 — HR-RS / Fatigue Diagnostics
Purpose: monitor fatigue markers

Visuals:
- KPI cards:
  - Average HR-RS Deviation
  - Average Cardiac Drift
  - Average Fatigue Index
  - High HR-RS Sessions
- Line chart:
  - HR-RS Deviation over time
- Scatter:
  - HR-RS Deviation vs Avg Speed
- Scatter:
  - HR-RS Deviation vs TRIMP
- Column or line:
  - Fatigue Index over time
- Table:
  - Session Date
  - HR-RS Deviation
  - Cardiac Drift
  - Fatigue Index
  - TRIMP

## Page 7 — Training Score Breakdown
Purpose: explain the score

Visuals:
- KPI card:
  - Overall Score Latest
- Stacked bar:
  - Latest score contributions:
    - Running Economy
    - VO2max
    - Distance
    - Efficiency
    - Heart Rate
- Line chart:
  - Overall Score over snapshot date
- Cards:
  - Running Economy Trend Latest
  - Distance Progression Latest
- Table:
  - raw means/stds from FactMetricsBreakdown

## Page 8 — Monthly Deep Dive
Purpose: clean monthly reporting page

Visuals:
- Matrix:
  - Year-Month
  - Sessions
  - Distance Mean
  - TRIMP Mean
  - Avg Speed Mean
  - Recovery Mean
  - Readiness Mean
- Small multiples:
  - Distance Mean
  - TRIMP Mean
  - Avg Speed Mean
  - HR-RS Mean
- Conditional formatting:
  - highlight poor recovery / high HR-RS months

## Page 9 — Session Detail
Purpose: operational detail page

Visuals:
- Table:
  - Session Date
  - Distance
  - Duration Min
  - Heart Rate
  - Avg Speed
  - Max Speed
  - Pace Per KM
  - TRIMP
  - Recovery Score
  - Readiness Score
  - HR-RS Deviation
  - Fatigue Index
- Add conditional formatting:
  - high fatigue in red
  - low recovery in orange
  - high HR-RS in red

## Page 10 — Coach Summary
Purpose: story-like interpretation page

Use:
- Smart narrative visual
- KPI cards
- trend charts
- latest session cards

Suggested cards:
- Last Session Distance KM
- Last Session Avg Speed
- Last Session Pace
- Last Session TRIMP
- Last Session Recovery
- Last Session Readiness
