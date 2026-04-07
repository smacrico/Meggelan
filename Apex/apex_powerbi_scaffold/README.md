# Apex Power BI Reporting Scaffold

This scaffold gives you a clean starting point for a robust Power BI report over your `Apex.db` SQLite database.

Included:
- `sql/01_views.sql` — SQL views for Power BI import
- `dax/measures.dax` — ready-to-paste DAX measures
- `theme/apex_theme.json` — Power BI theme
- `model/star_schema_plan.md` — star-schema design
- `report/report_pages.md` — page-by-page report design

## Assumptions

Database tables expected:
- `running_sessions`
- `training_logs`
- `monthly_summaries`
- `metrics_breakdown`

Key assumptions from your Python pipeline:
- `date` is the primary session date
- `time` is stored in minutes
- `distance` is stored in km
- `avg_speed` and `max_speed` are stored in km/h

## Power BI Desktop setup

### 1) Install a SQLite connector
Power BI Desktop does not natively connect to SQLite in all setups. Use one of these approaches:
- ODBC SQLite driver, then connect with **Get Data > ODBC**
- Power Query via Python/R bridge if you already use that stack
- Export the views to CSV as a fallback

The easiest path is usually **ODBC**.

### 2) Create the views
Open your SQLite tool and run:

```sql
.read sql/01_views.sql
```

or paste the SQL manually into your SQLite client against `Apex.db`.

### 3) Connect Power BI to the database
In Power BI Desktop:
- Get Data
- ODBC
- choose your SQLite DSN / driver
- select these views:
  - `vw_fact_running_sessions`
  - `vw_fact_training_logs`
  - `vw_fact_metrics_breakdown`
  - `vw_fact_monthly_summaries`
  - `vw_dim_date`
  - `vw_dim_speed_zone`
  - `vw_dim_risk_level`

### 4) Build relationships
Use the star-schema plan in `model/star_schema_plan.md`.

### 5) Add the DAX
Create a dedicated measures table and paste the measures from `dax/measures.dax`.

### 6) Apply the theme
In Power BI Desktop:
- View
- Themes
- Browse for themes
- select `theme/apex_theme.json`

### 7) Build the pages
Use `report/report_pages.md` as the report blueprint.

## Recommended refresh strategy

Because your Python app writes analytics tables into SQLite:
1. run `main.py`
2. refresh Power BI Desktop
3. publish only when data looks correct

## Recommended Power BI model preference

Prefer using:
- `vw_fact_training_logs` for session-level visuals
- `vw_fact_monthly_summaries` for monthly trend visuals
- `vw_fact_metrics_breakdown` for score contribution / diagnostics

## Notes

This scaffold does not generate a `.pbix` file directly.
It is designed so you can assemble a high-quality Power BI report quickly and cleanly.
