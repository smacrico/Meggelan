# HRV Power BI Opinionated Starter Pack

This package is a more opinionated version of the Power BI starter for `hrv_platform.db`.

## Included

- `sql/powerbi_views.sql`
- `dax/measures.dax`
- `theme/hrv_theme.json`
- `docs/POWERBI_GUIDE.md`
- `docs/PAGE_LAYOUTS.md`
- `wireframes/REPORT_WIREFRAMES.txt`

## What is new in this version

- Stronger page-by-page report layout
- Visual placement guidance
- Narrative intent for each page
- A more defined executive-to-analyst report flow

## Recommended pages

1. Executive Overview
2. Trend Diagnostics
3. Baseline vs Latest
4. Alerts & Anomalies
5. Raw Metric Explorer
6. Baseline History
7. Snapshot Quality Control

## Quick start

1. Run the SQL views against `hrv_platform.db`
2. Open Power BI Desktop
3. Connect to the SQLite DB
4. Load the views
5. Build relationships
6. Import the theme
7. Add the DAX measures
8. Build pages using `docs/PAGE_LAYOUTS.md`
