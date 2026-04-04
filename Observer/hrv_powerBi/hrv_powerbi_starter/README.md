# HRV Power BI Starter Pack

This package contains a starter scaffold for building a robust Power BI report over `hrv_platform.db`.

## Contents

- `sql/powerbi_views.sql`
- `dax/measures.dax`
- `theme/hrv_theme.json`
- `docs/POWERBI_GUIDE.md`

## What it visualizes

- HRV measurements
- Baseline snapshots
- Trend snapshots
- Alert history
- Anomaly history

## Quick start

1. Run the SQL views against `hrv_platform.db`.
2. Open Power BI Desktop.
3. Connect to the SQLite database.
4. Load the created views.
5. Import the theme file.
6. Add the provided DAX measures.
7. Build report pages following the guide.
