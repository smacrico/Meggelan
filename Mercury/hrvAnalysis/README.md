Here is a **clean, production-ready `README.md`** tailored to your now fully working system. It’s structured for real-world use (dev onboarding, deployment, debugging, and usage).

---

# 🫀 HRV Platform

A full-stack HRV (Heart Rate Variability) analytics platform that ingests data from Artemis, performs advanced analysis, and delivers insights via API, dashboard, and exportable reports.

---

## 🚀 Features

### Core Capabilities

* ✅ Artemis → HRV ingestion pipeline
* ✅ Centralized analytics database (`hrv_platform.db`)
* ✅ Regression-based trend analysis
* ✅ MS recovery score (normalized)
* ✅ Baseline computation (mean + std)
* ✅ Anomaly detection (z-score)
* ✅ Alert generation (deviation-based)
* ✅ Real-time updates (WebSocket)
* ✅ API-driven dashboard
* ✅ PNG export (legacy-compatible)

---

## 🧱 System Architecture

```
Artemis DB / View
        ↓
ArtemisSource (validation + normalization)
        ↓
hrv_measurements (raw data)
        ↓
RecalculationService
        ↓
-------------------------------------------------
| hrv_baselines | hrv_trends | alerts | anomalies |
-------------------------------------------------
        ↓
FastAPI API → Dashboard / Plots / WebSocket
```

---

## 📁 Project Structure

```
hrv_platform/
│
├── api/
│   ├── app.py              # FastAPI app
│   ├── routes.py           # ingestion + debug + websocket
│   ├── summary.py          # summary endpoint
│   ├── trends.py           # trends endpoint
│   ├── anomalies.py        # anomalies endpoint
│
├── sources/
│   └── artemis.py          # Artemis integration
│
├── models.py               # DB schema
├── repository.py           # DB access layer
├── recalc.py               # analytics engine
├── scoring.py              # MS score
├── trends.py               # regression logic
├── anomalies.py            # anomaly detection
├── plots.py                # PNG export
├── live.py                 # websocket event bus
├── cli.py                  # CLI interface
├── db.py                   # DB setup
├── config.py               # configuration
│
└── templates/
    └── dashboard.html      # API dashboard
```

---

## ⚙️ Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

If WebSocket warnings appear:

```bash
pip install "uvicorn[standard]"
```

---

### 2. Configure Artemis

Edit `config.py`:

```python
artemis_db_path = "path/to/artemis.db"
artemis_source_view = "your_view"
```

Ensure the Artemis view contains:

```
measurement_date
SD1, SD2, sdnn, rmssd, pNN50, VLF, LF, HF
```

---

### 3. Initialize database

```bash
python -m hrv_platform.cli init-db
```

Creates:

```
hrv_platform.db
```

---

## ▶️ Running the Application

### Step 1 — Sync data from Artemis

```bash
python -m hrv_platform.cli sync-artemis
```

✔ Imports data
✔ Normalizes
✔ Stores in DB
✔ Runs full recalculation

---

### Step 2 — Start API server

```bash
python -m hrv_platform.cli serve
```

---

### Step 3 — Open dashboard

```
http://127.0.0.1:8000/dashboard
```

---

## 📊 Dashboard

### Features

* Data points count
* MS recovery score
* Date range
* Alerts count
* Current HRV values
* Baselines
* Trend analysis table
* Anomaly detection table
* Live updates via WebSocket

---

## 🔌 API Endpoints

### Health Check

```
GET /api/health
```

---

### Summary

```
GET /api/summary?source_name=MyHRV_import
```

Returns:

* current values
* baselines
* MS score
* alerts
* date range

---

### Trends

```
GET /api/trends?source_name=MyHRV_import
```

Includes:

* slope
* correlation (R)
* direction
* strength

---

### Anomalies

```
GET /api/anomalies?source_name=MyHRV_import
```

Includes:

* z-score
* deviation
* message

---

### Artemis Integration

#### Preview

```
GET /api/import/artemis/preview
```

#### Sync

```
POST /api/import/artemis
```

---

### WebSocket

```
ws://127.0.0.1:8000/ws/live
```

Events:

* `artemis_synced`
* `summary_updated`
* `measurement_ingested`

---

## 📈 Plot Export (PNG)

### Command

```bash
python -m hrv_platform.cli export-plots
```

### Output

```
C:\temp\logsFitnessApp\HRV_DashBoards
```

### Generated Files

* HRV_TimeTrends
* HRV_Histograms
* HRV_BaselineProfile
* HRV_RadarChart
* HRV_MSScore
* HRV_TrendSummary

✔ Fully compatible with legacy HTML dashboard

---

## 🔄 Data Flow Explained

### Why Artemis is still used

Artemis is your **data source**, not your analytics engine.

| Stage         | Source          |
| ------------- | --------------- |
| Raw ingestion | Artemis         |
| Storage       | hrv_platform.db |
| Analytics     | hrv_platform    |
| Dashboard     | API             |
| Plots         | hrv_platform    |

👉 After sync, everything runs from your platform DB.

---

## 🧠 Analytics Details

### Baselines

* Mean + standard deviation
* Stored in `hrv_baselines`

---

### Trends

* Linear regression (`numpy.polyfit`)
* Correlation strength classification:

  * strong ≥ 0.7
  * moderate ≥ 0.3
  * weak < 0.3

---

### MS Recovery Score

* Derived from HRV metrics
* Normalized (0–100)

---

### Anomalies

* Z-score detection
* Stored in `hrv_anomalies`

---

### Alerts

* Based on deviation from baseline

---

## 🔁 Recalculation Engine

Triggered automatically on sync:

```python
RecalculationService.recompute_all()
```

Updates:

* baselines
* trends
* alerts
* anomalies

---

## 🧪 Debug Endpoints

### Check sources

```
/api/debug/source-names
```

---

### Check measurements

```
/api/debug/measurements
```

---

## ⚠️ Common Issues

### Dashboard not loading

❌ Opening HTML directly

✅ Use:

```
http://127.0.0.1:8000/dashboard
```

---

### Connection refused

➡ Server not running

```bash
python -m hrv_platform.cli serve
```

---

### No data returned

➡ Wrong `source_name`

Check:

```
/api/debug/source-names
```

---

### Artemis errors

* Missing columns
* Invalid view name
* Wrong DB path

---

## 🔁 Recommended Workflow

```bash
init-db
   ↓
sync-artemis
   ↓
serve
   ↓
dashboard
   ↓
export-plots
```

---

## 🔮 Future Improvements

* Docker containerization
* PostgreSQL migration
* Authentication & users
* Scheduled ingestion (cron / Celery)
* ML anomaly detection
* Advanced frontend (React dashboard)

---

## ✅ Summary

You now have:

✔ Full HRV analytics platform
✔ Clean architecture
✔ Real-time dashboard
✔ Artemis ingestion pipeline
✔ Exportable reports
✔ Production-ready backend

---

If you want next step, I’d go straight to:

👉 **Docker + Postgres + automated ingestion (true production setup)**
