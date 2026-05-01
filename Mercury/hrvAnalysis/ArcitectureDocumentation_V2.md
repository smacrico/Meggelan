Here is a polished, production-ready `ARCHITECTURE.md` for your project.

---

```markdown
# HRV Platform – Architecture

## Overview

The **HRV Platform** is a modular analytics system designed to:

- Ingest HRV data from external sources (Artemis)
- Persist normalized data in a central SQLite database
- Compute advanced analytics (baselines, trends, anomalies, alerts)
- Predict MS flare risk using multi-factor scoring
- Expose results via API, dashboard, and Power BI
- Export visual outputs (PNG) and aggregated datasets

---

## High-Level Architecture

```

Artemis DB (external)
│
▼
ArtemisSource (read + normalize)
│
▼
ArtemisSyncService
│
▼
hrv_measurements (raw data)
│
▼
RecalculationService
│
├── hrv_baselines
├── hrv_trends
├── hrv_alerts
├── hrv_anomalies
│
▼
MS Flare Risk Service
│
▼
ms_risk_predictions
│
▼
API / Dashboard / Power BI / PNG Export

```

---

## Execution Flow

### CLI Commands

| Command | Description |
|--------|-------------|
| `init-db` | Initialize database and create tables |
| `preview-artemis` | Preview source data (no writes) |
| `sync-artemis` | Ingest + compute analytics |
| `watch-artemis` | Continuous ingestion loop |
| `export-plots` | Generate PNG visualizations |
| `serve` | Start API and dashboard |

---

## Data Flow

### 1. Ingestion

- Source: Artemis SQLite DB (view/table)
- Component: `ArtemisSource`
- Output: normalized records

### 2. Persistence

- Table: `hrv_measurements`
- Operation: upsert (by date + source)

### 3. Analytics

Triggered during sync:

- Baselines → `hrv_baselines`
- Trends → `hrv_trends`
- Alerts → `hrv_alerts`
- Anomalies → `hrv_anomalies`

### 4. Derived Aggregations

Stored in:

- `calc_file_summary`
- `calc_weekly_trends`
- `calc_monthly_trends`

### 5. MS Flare Risk

Inputs:
- HRV measurements
- trends
- alerts
- anomalies
- optional symptom + medication logs

Output:
- `ms_risk_predictions`

---

## Database

### Primary Database

```

hrv_platform.db

```

Created via:

```

python -m hrv_platform.cli init-db

```

---

## Tables

### Core Tables

#### `hrv_measurements`
Raw HRV data.

#### `hrv_baselines`
Rolling baseline statistics (mean + std per metric).

#### `hrv_trends`
Regression-based trend analytics.

#### `hrv_alerts`
Threshold-based deviations.

#### `hrv_anomalies`
Z-score anomaly detection.

---

### Aggregation Tables

| Table | Purpose |
|------|--------|
| `calc_file_summary` | Per-run summary |
| `calc_weekly_trends` | Weekly aggregation |
| `calc_monthly_trends` | Monthly aggregation |

---

### MS Risk Tables

| Table | Purpose |
|------|--------|
| `ms_risk_predictions` | Risk scoring output |
| `symptom_log` | Symptom tracking |
| `medication_log` | Adherence tracking |
| `flare_history` | Historical flares |

---

## Data Retention Strategy

- **Append-only** for analytics tables
- Historical snapshots preserved
- No deletion of previous rows

Exception:
- `hrv_measurements` uses upsert logic

---

## API Layer

### Framework

- FastAPI
- Uvicorn server

### Key Endpoints

#### HRV

- `GET /api/summary`
- `GET /api/trends`
- `GET /api/anomalies`

#### Import

- `GET /api/import/artemis/preview`
- `POST /api/import/artemis`

#### MS Risk

- `GET /api/ms-flare-risk`
- `GET /api/ms-flare-risk/history`

#### Debug

- `GET /api/debug/measurements`
- `GET /api/debug/source-names`

#### Live

- `WS /ws/live`

---

## Dashboard

### Location

```

/templates/dashboard.html

```

### Access

```

[http://127.0.0.1:8000/](http://127.0.0.1:8000/)

```

### Data Source

- REST API endpoints
- WebSocket (optional live updates)

---

## Power BI Integration

### Source

- SQLite: `hrv_platform.db`

### Recommended Views

- `vw_ms_risk_predictions`
- `vw_ms_risk_latest_by_source`
- `vw_dim_date`

### Features

- Risk scoring visualization
- Trend analysis
- Component breakdown
- Historical tracking

---

## Plot Export

### Command

```

python -m hrv_platform.cli export-plots

```

### Output Location

Default:

```

C:\temp

```

Or configured path.

### Files

- Time trends
- Histograms
- Baseline profiles
- Radar charts
- MS score plots

---

## Logging

### Current Behavior

- Console-based logging (stdout)
- Uvicorn logs
- CLI prints

### Recommended Setup

```

logs/
├── app.log
├── sync.log
└── api.log

```

---

## File Structure (Recommended)

```

project/
├── src/hrv_platform/
├── frontend/
├── logs/
├── exports/
│   ├── png/
│   └── csv/
├── hrv_platform.db
├── README.md
└── ARCHITECTURE.md

```

---

## Configuration

Defined in `config.py`.

Key parameters:

- `db_url`
- `artemis_db_path`
- `artemis_source_view`
- `source_name_default`
- `poll_interval`

---

## Real-Time Mode

Command:

```

python -m hrv_platform.cli watch-artemis

```

Behavior:

- Poll Artemis periodically
- Sync new data
- Recompute analytics
- Push updates (if WebSocket enabled)

---

## Key Design Principles

### 1. Separation of Concerns
- ingestion
- storage
- analytics
- presentation

### 2. Single Source of Truth
- `hrv_measurements` drives all analytics

### 3. Persistent Analytics
- All results stored (not recomputed on every request)

### 4. Extensibility
- New risk models or metrics can be added easily

### 5. BI-First Design
- Tables optimized for Power BI consumption

---

## Summary

The HRV Platform is a complete analytics pipeline that:

- Transforms raw HRV data into structured insights
- Persists all intermediate and final results
- Provides real-time and historical analytics
- Enables clinical-grade MS flare-risk prediction
- Integrates seamlessly with dashboards and Power BI

```

---

If you want next, I can also:

* generate a **SYSTEM_DIAGRAM.png**
* add **sequence diagrams**
* or merge this into your **README.md with badges + diagrams**

Just say 👍
