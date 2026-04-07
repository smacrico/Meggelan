# HRV Platform

A full-stack HRV analytics platform with:

* Artemis data ingestion (SQLite view/table)
* Internal analytics engine (baselines, trends, alerts, anomalies)
* MS flare-risk prediction engine
* REST API (FastAPI)
* Real-time dashboard (frontend)
* Plot export (PNG)
* Power BI integration (via SQLite views)

---

# 🧠 Architecture Overview

```
Artemis DB (external)
        │
        ▼
ArtemisSource → ArtemisSyncService
        │
        ▼
hrv_platform.db (internal DB)
        │
        ├── hrv_measurements (raw data)
        ├── hrv_baselines
        ├── hrv_trends
        ├── hrv_alerts
        ├── hrv_anomalies
        ├── calc_* (aggregations)
        └── ms_risk_predictions
        │
        ▼
Analytics Services (recalc, scoring, trends, anomalies)
        │
        ▼
API (FastAPI)
        │
        ├── Dashboard (frontend)
        ├── Plot export (PNG)
        └── Power BI (SQLite views)
```

---

# 📦 Features

## 1. Data Ingestion (Artemis)

Pulls HRV data from Artemis SQLite DB:

* Configurable source view
* Column validation
* Normalization into internal schema

### Command

```bash
python -m hrv_platform.cli preview-artemis
python -m hrv_platform.cli sync-artemis
```

### Flow

```
Artemis DB → ArtemisSource → normalize() → HRVRepository → hrv_measurements
```

---

## 2. Internal Database (hrv_platform.db)

### Core Tables

| Table            | Description                   |
| ---------------- | ----------------------------- |
| hrv_measurements | Raw HRV data                  |
| hrv_baselines    | Rolling statistical baselines |
| hrv_trends       | Regression trends per metric  |
| hrv_alerts       | Threshold-based alerts        |
| hrv_anomalies    | Z-score anomalies             |

### Derived Tables

| Table               | Description         |
| ------------------- | ------------------- |
| calc_file_summary   | Daily summary       |
| calc_weekly_trends  | Weekly aggregation  |
| calc_monthly_trends | Monthly aggregation |

### MS Risk

| Table               | Description             |
| ------------------- | ----------------------- |
| ms_risk_predictions | Daily flare-risk output |

---

## 3. Analytics Engine

### Triggered via:

```bash
python -m hrv_platform.cli sync-artemis
```

### Components

#### Baselines

* Mean / std per metric
* Built from full history (non-overlapping)

#### Trends

* Linear regression slope
* Correlation strength
* Direction (improving / declining / stable)

#### Alerts

* Deviation from baseline
* Threshold-based

#### Anomalies

* Z-score detection
* Per metric

---

## 4. MS Flare Risk Engine

Built on top of internal HRV tables.

### Inputs

* HRV trends
* Baselines
* Alerts
* Anomalies
* (optional) symptoms / medication

### Output

* Overall risk score (0–1)
* Risk level:

  * LOW
  * MODERATE
  * HIGH
  * CRITICAL
* Component scores:

  * HRV
  * Trends
  * Alerts
  * Anomalies
  * Symptoms
  * Medication

### API

```
GET /api/ms-flare-risk
GET /api/ms-flare-risk/history
```

---

## 5. API Endpoints

## Core

| Endpoint              | Description        |
| --------------------- | ------------------ |
| GET /api/summary      | Full HRV summary   |
| GET /api/trends       | Trends per metric  |
| GET /api/anomalies    | Detected anomalies |
| GET /api/measurements | Raw data           |

## Artemis

| Endpoint                 | Description  |
| ------------------------ | ------------ |
| POST /api/import/artemis | Trigger sync |

## MS Risk

| Endpoint                       | Description     |
| ------------------------------ | --------------- |
| GET /api/ms-flare-risk         | Latest risk     |
| GET /api/ms-flare-risk/history | Historical risk |

---

## 6. Dashboard (Frontend)

Served via:

```
http://127.0.0.1:8000
```

### Sections

### 🧠 MS Flare Risk Panel

* Risk score
* Risk level
* Component breakdown
* Recommendations

### 📊 HRV Trends

* Line charts per metric

### ⚠️ Alerts & Anomalies

* Tables of deviations

### 📈 Metrics Overview

* SDNN, RMSSD, LF/HF, etc.

---

## 7. Plot Export (PNG)

Exports production-ready dashboards.

### Command

```bash
python -m hrv_platform.cli export-plots
```

### Output

```
C:\temp\logsFitnessApp\HRV_DashBoards\
```

### Generated

* Trends charts
* Baseline comparisons
* Risk overlays

---

## 8. Power BI Integration

## SQLite Views

Use:

* `vw_ms_risk_predictions`
* `vw_ms_risk_latest_by_source`
* `vw_dim_date`

## Measures

Use provided:

```
measures_ms_risk.dax
```

## Visuals

Recommended:

* KPI cards (risk score)
* Gauge (risk level)
* Line chart (risk over time)
* Stacked bar (components)

---

# ⚙️ Setup Guide

## 1. Install

```bash
pip install -r requirements.txt
```

## 2. Configure

Edit:

```
hrv_platform/config.py
```

Key values:

* `db_url`
* `artemis_db_path`
* `artemis_source_view`

---

## 3. Initialize DB

```bash
python -m hrv_platform.cli init-db
```

---

## 4. Sync Data

```bash
python -m hrv_platform.cli sync-artemis
```

---

## 5. Run API

```bash
python -m hrv_platform.cli serve
```

Open:

```
http://127.0.0.1:8000
```

---

## 6. Export Plots

```bash
python -m hrv_platform.cli export-plots
```

---

# 🔁 Data Flow Summary

```
Artemis → sync → hrv_measurements
          ↓
     recalculation
          ↓
 baselines / trends / alerts / anomalies
          ↓
 MS risk engine
          ↓
 API + Dashboard + Power BI
```

---

# 🧪 Debug Checklist

## No tables created

* Ensure:

```python
from . import models
```

## Empty dashboard

* Check `/api/summary`
* Verify data exists in `hrv_measurements`

## MS risk not working

* Check:

```
/api/ms-flare-risk
```

---

# 🚀 Future Enhancements

* Real-time WebSocket updates
* Patient segmentation
* ML-based flare prediction
* Cloud deployment (Azure / AWS)
* Authentication & multi-user

---

# ✅ Summary

You now have:

* Full HRV pipeline
* Internal analytics engine
* MS flare prediction system
* API + dashboard
* Plot export
* Power BI integration

This is production-ready architecture for **health analytics + predictive monitoring**.

---
