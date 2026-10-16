# Training Metrics App

This app reproduces the workbook's core training metrics and produces:

- Training trend charts for Fitness (CTL), Fatigue (ATL), and Form (TSB)
- Workout-type breakdown
- Running pace and heart-rate analysis
- Race-readiness assessment using the workbook's `PMC forecast` sheet when available

## Source of data

Primary source: **Intervals.icu activity export**.

You can provide either:

1. The original Excel workbook containing the sheet:
   - `intervals.icu_activities-export`

2. A CSV export from Intervals.icu activities with the same field names.

Required columns:

| Column | Meaning |
|---|---|
| `start_date_local` | Activity start date/time |
| `type` | Workout type, e.g. Run, Ride, Workout, Walk |
| `moving_time` | Moving seconds |
| `icu_training_load` | Intervals.icu activity training load |

Recommended optional columns:

| Column | Used for |
|---|---|
| `icu_training_load_edited` | Overrides training load when present |
| `distance` | Distance in meters |
| `average_speed` | Pace calculation; expected in m/s |
| `average_heartrate`, `max_heartrate` | Heart-rate analysis |
| `name` | Activity listing |
| `pace`, `threshold_pace`, `lthr`, `hr_load`, `pace_load` | Additional run/HR context |

Optional source for race-readiness forecast:

- Excel sheet `PMC forecast`, if present in the workbook.
- If it is unavailable, the app calculates PMC from the activity export only.

## Metric formulas

Daily load is the sum of `icu_training_load_edited` when present, otherwise `icu_training_load`.

Fitness / CTL:

```text
CTL_today = Load_today * (1 - exp(-1/42)) + CTL_yesterday * exp(-1/42)
```

Fatigue / ATL:

```text
ATL_today = Load_today * (1 - exp(-1/7)) + ATL_yesterday * exp(-1/7)
```

Form / TSB:

```text
TSB = CTL - ATL
```

Intensity:

```text
Intensity = sqrt(Daily Load / (100 * moving_hours))
```

Run pace:

```text
pace_min_per_km = 1000 / average_speed / 60
```

## Install

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run as an interactive app

```bash
streamlit run app.py
```

Upload an Intervals.icu CSV export or the workbook XLSX.

## Run from the command line

```bash
python app.py "JHeel Next Activity_icu v2.2 (shared).xlsx" --out training_report
```

This creates:

- `training_trend_ctl_atl_form.png`
- `workout_type_breakdown.png`
- `running_pace_hr_analysis.png`
- `race_readiness_assessment.md`
- `daily_metrics.csv`
- `workout_type_breakdown.csv`
- `running_pace_hr_analysis.csv`

## Security note

Do not commit or share files containing your Intervals.icu API key. The app does not need the API key when using exported CSV/XLSX files.
