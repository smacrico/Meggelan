Here is a clear architecture and runtime document for the HRV Analysis Platform as built so far.

# Architecture Overview

The platform is a layered SQLite-based HRV analytics system.

It has four main parts:

1. data ingestion from Artemis
2. internal analytics and persistence in `hrv_platform.db`
3. API and dashboard serving
4. downstream outputs like PNG exports and Power BI views

The core execution flow is:

```text
Artemis DB/view
    -> ArtemisSource
    -> ArtemisSyncService
    -> hrv_measurements
    -> RecalculationService
    -> hrv_baselines / hrv_trends / hrv_alerts / hrv_anomalies
    -> MS flare-risk service
    -> ms_risk_predictions
    -> API / dashboard / Power BI / PNG export
```

# How it is executed

## Main commands

From the project root:

```bash
python -m hrv_platform.cli init-db
python -m hrv_platform.cli preview-artemis
python -m hrv_platform.cli sync-artemis
python -m hrv_platform.cli export-plots
python -m hrv_platform.cli serve
```

## What each command does

### `init-db`

Initializes the internal SQLite database schema.

This creates the platform tables in `hrv_platform.db`.

### `preview-artemis`

Reads the configured Artemis source view and prints:

* source view name
* row count
* column names
* sample rows

It does not write data into the platform DB.

### `sync-artemis`

Reads Artemis HRV data, normalizes it, writes/upserts into `hrv_measurements`, then recomputes derived analytics.

This is the main data-processing command.

### `export-plots`

Reads from `hrv_platform.db` and exports PNG charts.

### `serve`

Starts the FastAPI app and serves:

* API endpoints
* dashboard HTML
* WebSocket live endpoint

# Which database is created

The internal application database is:

```text
hrv_platform.db
```

This is the system-of-record for the platform after ingestion.

Important distinction:

* **Artemis DB** is the upstream source
* **`hrv_platform.db`** is the internal analytics and presentation database

# Where the database is created

It is created wherever your configured DB path points.

If your config uses a relative SQLite URL like:

```text
sqlite:///./hrv_platform.db
```

then it is created in the **current working directory** where you run the app.

If you use an absolute path, it is created there instead.

Best practice is to configure an absolute or project-root-relative path to avoid accidental creation of multiple DB files after moving the project.

# Tables created in `hrv_platform.db`

## Core HRV tables

### `hrv_measurements`

Raw normalized HRV measurements imported from Artemis.

Typical columns:

* `id`
* `measurement_date`
* `source_name`
* `SD1`
* `SD2`
* `sdnn`
* `rmssd`
* `pNN50`
* `VLF`
* `LF`
* `HF`
* `created_at`

Purpose:

* canonical raw HRV store
* source of truth for downstream analytics

---

### `hrv_baselines`

Persisted baseline snapshots computed from `hrv_measurements`.

Typical columns:

* `id`
* `source_name`
* `analysis_date`
* `avg_SD1`, `avg_SD2`, `avg_sdnn`, `avg_rmssd`, `avg_pNN50`, `avg_VLF`, `avg_LF`, `avg_HF`
* `std_SD1`, `std_SD2`, `std_sdnn`, `std_rmssd`, `std_pNN50`, `std_VLF`, `std_LF`, `std_HF`

Purpose:

* baseline means and standard deviations
* latest baseline for dashboard, plots, and flare-risk scoring

---

### `hrv_trends`

Persisted regression-style trend snapshots.

Typical columns:

* `id`
* `analysis_date`
* `source_name`
* `metric`
* `slope`
* `r_value`
* `p_value`
* `trend_direction`
* `trend_strength`
* `mean`
* `std`
* `min`
* `max`
* `latest_ms_score`

Purpose:

* trend diagnostics
* dashboard trend table
* Power BI trend visuals
* flare-risk trend component

---

### `hrv_alerts`

Persisted threshold-based alerts.

Typical columns:

* `id`
* `alert_date`
* `source_name`
* `metric`
* `current_value`
* `baseline_value`
* `deviation_pct`
* `alert_type`
* `alert_message`
* `created_at`

Purpose:

* event log of significant deviations from baseline

---

### `hrv_anomalies`

Persisted anomaly detections, typically z-score based.

Typical columns:

* `id`
* `detected_at`
* `measurement_date`
* `source_name`
* `metric`
* `value`
* `baseline_mean`
* `baseline_std`
* `z_score`
* `detector`
* `message`

Purpose:

* outlier tracking
* anomaly table in dashboard
* anomaly component in flare-risk model

## Calculation tables

These store exported/derived aggregate tables with `calc_` prefix.

### `calc_file_summary`

Stores per-run summary rows that were also exported to CSV.

Purpose:

* file-level summary persistence
* Power BI reporting
* audit/history of calculations

### `calc_weekly_trends`

Stores weekly aggregation/trend rows.

Purpose:

* weekly trend history
* stable reporting layer

### `calc_monthly_trends`

Stores monthly aggregation/trend rows.

Purpose:

* monthly trend history
* executive reporting layer

## MS flare-risk tables

### `symptom_log`

Stores manually or externally provided symptom context.

Typical columns:

* `date`
* `source_name`
* `fatigue_level`
* `cognitive_fog`
* `mobility_score`
* `pain_level`
* `mood_score`
* `heat_sensitivity`
* `overall_wellbeing`
* `notes`

Purpose:

* symptom component of MS flare-risk scoring

---

### `medication_log`

Stores medication adherence context.

Typical columns:

* `date`
* `source_name`
* `medication_name`
* `scheduled_dose_time`
* `actual_dose_time`
* `dose_taken`
* `side_effects`

Purpose:

* medication adherence component of MS flare-risk scoring

---

### `flare_history`

Stores known flare events.

Typical columns:

* `flare_date`
* `source_name`
* `flare_severity`
* `symptoms_affected`
* `duration_days`
* `recovery_days`
* `triggers_identified`

Purpose:

* historical flare reference
* future model calibration / validation

---

### `ms_risk_predictions`

Stores the output of the MS flare-risk engine.

Typical columns:

* `id`
* `prediction_timestamp`
* `prediction_date`
* `source_name`
* `overall_risk_score`
* `hrv_component`
* `trend_component`
* `alert_component`
* `anomaly_component`
* `symptom_component`
* `medication_component`
* `risk_level`
* `recommendations`
* `data_quality_notes`
* `created_at`

Purpose:

* persisted daily/periodic flare-risk predictions
* dashboard MS risk section
* Power BI MS risk reporting

# Which tables are updated during sync

When you run:

```bash
python -m hrv_platform.cli sync-artemis
```

the platform updates:

1. `hrv_measurements`
2. `hrv_baselines`
3. `hrv_trends`
4. `hrv_alerts`
5. `hrv_anomalies`

If your calculation persistence is wired in, it also updates:

6. `calc_file_summary`
7. `calc_weekly_trends`
8. `calc_monthly_trends`

If flare-risk prediction is run as part of the workflow or via API persistence, it also inserts into:

9. `ms_risk_predictions`

# Whether old rows are deleted

Current intended design is append-style history for derived tables.

That means:

* old rows are preserved
* each recomputation inserts a new snapshot

This applies especially to:

* `hrv_baselines`
* `hrv_trends`
* `hrv_alerts`
* `hrv_anomalies`
* `calc_*`
* `ms_risk_predictions`

`hrv_measurements` is different: it is normally upserted by `(measurement_date, source_name)` so raw rows do not duplicate unnecessarily.

# API runtime architecture

When you run:

```bash
python -m hrv_platform.cli serve
```

Uvicorn loads:

```text
hrv_platform.api.app:app
```

FastAPI then serves:

* JSON API endpoints
* dashboard HTML
* WebSocket live updates

## Important API endpoints

### Core HRV

* `GET /api/summary`
* `GET /api/trends`
* `GET /api/anomalies`

### Import

* `GET /api/import/artemis/preview`
* `POST /api/import/artemis`

### Debug

* `GET /api/debug/source-names`
* `GET /api/debug/measurements`

### MS flare risk

* `GET /api/ms-flare-risk`
* `GET /api/ms-flare-risk/history`

### Live

* `WS /ws/live`

# Dashboard location and serving

The dashboard is served by FastAPI and should be opened at:

```text
http://127.0.0.1:8000/dashboard
```

or `/` depending on your app routing.

The dashboard file is typically located at:

```text
src/hrv_platform/templates/dashboard.html
```

or bundled frontend output if using a built frontend.

Important:

* do not open it directly from disk with `file:///...`
* it must be served through the running API so the endpoints resolve correctly

# Logs: where they are kept

## Application logs

At the moment, most logs are runtime console logs:

* CLI output printed to terminal
* FastAPI/Uvicorn logs printed to terminal
* Python logger output printed to stdout/stderr unless configured otherwise

Examples:

* sync messages
* API startup logs
* errors and stack traces
* prediction logs

## File-based logs

Unless you explicitly added a logging file handler, the platform does **not automatically keep rotating log files**.

If you want persistent logs, recommended locations are:

* `logs/hrv_platform.log`
* `logs/api.log`
* `logs/sync.log`

## Existing temp output path you used

You also referenced plot output under temp folders, for example:

```text
C:\temp\logsFitnessApp\HRV_DashBoards
```

That is an output folder, not a structured application log folder.

# Other output locations

## PNG plot export

Default location is intended to be:

```text
C:\temp
```

or previously:

```text
C:\temp\logsFitnessApp\HRV_DashBoards
```

depending on your current `plots.py`/CLI configuration.

Generated files include:

* `HRV_TimeTrends_*.png`
* `HRV_Histograms_*.png`
* `HRV_BaselineProfile_*.png`
* `HRV_RadarChart_*.png`
* `HRV_MSScore_*.png`
* `HRV_TrendSummary_*.png`

## Power BI outputs

The platform does not directly write `.pbix` files.

Instead it provides:

* SQLite tables
* SQLite views such as `vw_ms_risk_predictions`, `vw_ms_risk_latest_by_source`
* DAX measure definitions
* layout specifications

Power BI reads from `hrv_platform.db`.

## CSV outputs

If your calculation pipeline still exports CSV parity outputs, those are typically:

* `file-summary.csv`
* `weekly-trends.csv`
* `monthly-trends.csv`

These should also be persisted into:

* `calc_file_summary`
* `calc_weekly_trends`
* `calc_monthly_trends`

# Source data origin

## Upstream source

The original source is Artemis.

The Artemis connector reads from:

* a configured SQLite DB path
* a configured table or view name

Configured in `config.py`, typically with fields like:

* `artemis_db_path`
* `artemis_source_view`
* `allowed_source_views`
* `artemis_date_column`
* `artemis_source_name_column`

## Internal source after sync

After sync, the internal source of truth becomes:

```text
hrv_platform.db -> hrv_measurements
```

All downstream analytics should use that table, not Artemis directly.

That is why Artemis is only needed for:

* initial sync
* later refreshes
* real-time or periodic ingestion

# Real-time / watch mode

If you run:

```bash
python -m hrv_platform.cli watch-artemis
```

the platform continuously polls Artemis and re-runs sync.

That means:

* new raw rows go into `hrv_measurements`
* analytics snapshots are recomputed
* dashboard can update live if WebSocket publishing is wired

# Recommended production filesystem layout

A clean production layout would be:

```text
project-root/
├── src/
│   └── hrv_platform/
├── frontend/
├── logs/
│   ├── hrv_platform.log
│   ├── sync.log
│   └── api.log
├── exports/
│   ├── png/
│   └── csv/
├── hrv_platform.db
├── .env
├── pyproject.toml
└── README.md
```

Recommended output destinations:

* DB: `hrv_platform.db`
* Logs: `logs/`
* PNG: `exports/png/` or `C:\temp`
* CSV: `exports/csv/`

# In one sentence

The platform ingests HRV data from Artemis into `hrv_platform.db`, computes persistent analytics in `hrv_*`, `calc_*`, and `ms_risk_predictions` tables, exposes them through FastAPI/dashboard/Power BI, and exports plots and optional CSV outputs to configured filesystem locations.

If you want, I can turn this into a polished `ARCHITECTURE.md` or merge it into your `README.md` in final documentation form.
