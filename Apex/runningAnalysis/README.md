
# Running Dashboard Pro

This bundle includes a Streamlit dashboard that adds:

1. Auto-generated HTML dashboard export from the current Streamlit state
2. Plotly charts that are interactive and exportable
3. Anomaly detection for fatigue / overtraining flags

## Files

- `streamlit_app.py` — main Streamlit dashboard
- `repository.py` — SQLite data access
- `metrics.py` — metrics, scoring, rolling load, anomaly detection
- `html_export.py` — standalone HTML dashboard generator
- `requirements.txt`

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
streamlit run streamlit_app.py
```

## What it exports

### Full dashboard export
- standalone `.html` file
- includes KPI cards, interactive Plotly charts, anomaly tables, monthly summary

### Chart export
- `.html` for the selected chart
- `.png` if `kaleido` is installed and working

## Assumptions

- `time` is stored in minutes
- `distance` is in km
- `avg_speed` and `max_speed` are in km/h

## Anomaly logic included

### Medium fatigue risk
Triggered when one or more of these conditions appear:
- low recovery score
- low readiness score
- elevated HR-RS z-score
- very high fatigue index

### High overtraining risk
Triggered when one or more of these conditions appear:
- ACWR above 1.3
- very low recovery and readiness together
- very high HR-RS deviation combined with falling speed



# Running Dashboard Pro

This project gives you an interactive Streamlit dashboard for your running database, with:

- Plotly interactive charts
- HTML dashboard export from the current Streamlit state
- PNG / HTML export for individual charts
- anomaly detection for fatigue and overtraining risk
- monthly summaries and training score breakdowns

---

## Files you should have

Put these files in the same folder:

- `streamlit_app.py`
- `repository.py`
- `metrics.py`
- `html_export.py`
- `requirements.txt`

---

## Replace these files

Yes — replace your current versions of:

- `repository.py`
- `metrics.py`

with the full versions above.

Those updated files are required for:

- loading the running data consistently
- derived metrics like TRIMP, pace, speed efficiency, fatigue index
- recovery and readiness scores
- anomaly detection
- monthly summaries
- HTML / Streamlit export support

---

## Database assumptions

This code assumes:

- `time` is stored in **minutes**
- `distance` is stored in **km**
- `avg_speed` and `max_speed` are stored in **km/h**
- your SQLite table is named `running_sessions`

Expected columns in `running_sessions`:

- `date`
- `running_economy`
- `vo2max`
- `distance`
- `time`
- `heart_rate`
- `avg_speed`
- `max_speed`
- `HR_RS_Deviation_Index`
- `cardiacdrift`

If your table/column names differ, update the SQL in `repository.py`.

---

## Install

From the project folder:

```bash
pip install -r requirements.txt