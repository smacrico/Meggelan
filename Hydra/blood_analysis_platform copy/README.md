Here’s a complete, clean **README.md** for your project. You can copy-paste directly.

---

# 🧪 Blood Analysis Platform

A modular, extensible data platform for computing, storing, and visualizing **derived health metrics from blood test results**, starting with the **Lipidemic Profile**.

---

## 🚀 Overview

The Blood Analysis Platform is designed to:

* Ingest raw lab data (SQLite)
* Compute advanced derived biomarkers
* Track trends over time
* Classify risk categories
* Generate visualizations
* Support multiple health profiles (lipidemic, CBC, liver, etc.)

---

## 📦 Current Features

### ✅ Lipidemic Profile (v1)

Implements full lipid analysis including:

#### Core Metrics

* Total Cholesterol
* HDL
* LDL (reported + calculated)
* Triglycerides
* Non-HDL
* Lp(a)

#### Derived Metrics

* LDL (Friedewald + Sampson)
* Non-HDL (calculated)
* TC/HDL ratio
* LDL/HDL ratio
* TG/HDL ratio
* AIP (Atherogenic Index of Plasma)
* Remnant Cholesterol
* VLDL (estimated)
* Residual Cholesterol Burden

#### Risk Classifications

* TG status
* Non-HDL risk
* TC/HDL risk
* LDL/HDL risk
* TG/HDL risk
* AIP risk
* Remnant cholesterol risk

#### Trend Analytics

For each key metric:

* Previous value
* Delta
* % change
* Rolling average (3 points)

#### Data Quality Flags

* `has_core_lipids`
* `is_complete_profile`
* `record_quality_note`

---

## 🏗️ Architecture

```bash
blood_analysis_platform/
│
├── core/
│   ├── config.py           # Config loader
│   ├── db.py               # SQLite connection
│   ├── logging_utils.py    # Logging setup
│   └── plotting.py         # Plot utilities
│
├── profiles/
│   └── lipidemic/
│       ├── extract.py      # Data extraction
│       ├── transform.py    # Metric calculations
│       ├── load.py         # SQLite upsert
│       └── pipeline.py     # Orchestrated pipeline
│
├── orchestrator.py         # Runs profiles
├── main.py                 # CLI entrypoint
│
├── config/
│   └── config.json         # User configuration
```

---

## ⚙️ Configuration

Example:

```json
{
  "app_name": "Blood Analysis Platform",
  "database": {
    "sqlite_path": "C:/smakrykodbs/hydra.db"
  },
  "paths": {
    "log_dir": "C:/temp/LogsFitnessApp/Lipid_Dashboard",
    "plot_dir": "C:/temp/LogsFitnessApp/LipidLogs"
  },
  "profiles": {
    "lipidemic": {
      "enabled": true,
      "source_table": "lipid_raw",
      "target_table": "lipid_metrics",
      "date_column": "Exam Date",
      "columns": {
        "total_cholesterol": "Total Cholesterol",
        "hdl": "HDL",
        "ldl": "LDL",
        "triglycerides": "Triglycerides",
        "reported_non_hdl": "Reported Non-HDL",
        "lpa": "Lp(a)"
      }
    }
  }
}
```

---

## ▶️ Running the Platform

### Run a specific profile

```bash
python main.py --config config/config.json --profile lipidemic
```

### Run all enabled profiles

```bash
python main.py --config config/config.json --all
```

---

## 🗄️ Database

### Source Table

`lipid_raw`

Must contain columns (mapped via config):

* Exam Date
* Total Cholesterol
* HDL
* LDL
* Triglycerides
* Reported Non-HDL
* Lp(a)

---

### Target Table

`lipid_metrics`

Automatically created if missing.

Includes:

* Raw values
* Derived metrics
* Risk classifications
* Trend fields
* Quality indicators

---

## 📊 Output

### Logs

Stored in:

```
<log_dir>/blood_analysis_platform.log
```

### Plots

Saved to:

```
<plot_dir>/
```

Generated per metric:

* total_cholesterol_trend.png
* hdl_trend.png
* ldl_final_trend.png
* triglycerides_trend.png
* non_hdl_trend.png
* ratios
* AIP
* remnant cholesterol
* Lp(a)

---

## 🧠 Key Formulas

* **Non-HDL** = TC − HDL
* **TC/HDL** = TC ÷ HDL
* **LDL/HDL** = LDL ÷ HDL
* **TG/HDL** = TG ÷ HDL
* **AIP** = log10(TG / HDL) *(mmol/L)*
* **Remnant Cholesterol** = TC − HDL − LDL

LDL methods:

* Friedewald (TG < 400)
* Sampson (extended range)

---

## 🔌 Extending the Platform

To add a new profile:

1. Create new folder:

```bash
profiles/<new_profile>/
```

2. Implement:

* `extract.py`
* `transform.py`
* `load.py`
* `pipeline.py`

3. Register in:

```python
orchestrator.py
```

4. Add config section

---

## 📈 Design Principles

* Modular ETL (Extract / Transform / Load)
* Config-driven (no hardcoding)
* SQLite-first (portable)
* Trend-focused (not just snapshots)
* Clinically meaningful derived metrics
* Extensible for future profiles

---

## ⚠️ Notes

* Units assumed: **mg/dL**
* AIP correctly converts to **mmol/L**
* Derived metrics are **supportive, not diagnostic**
* Trend analysis is more important than single values

---

## 🔮 Roadmap

Next profiles:

* CBC / Hematology
* Iron Panel
* Liver Function
* Inflammation / Immune
* Vitamin / Nutritional

Future features:

* API layer
* Dashboard UI
* Alerts & anomaly detection
* ML-based trend prediction

---

## 👌 Summary

This platform turns raw lab data into:

* actionable metrics
* trend insights
* structured health intelligence

Starting with lipids — designed to scale to full blood analysis.

---

# Lipid Dashboard (Streamlit)

## Run
```bash
pip install streamlit pandas
streamlit run dashboard/app.py
```

## Features
- Reads `lipid_metrics` from SQLite
- KPI cards for latest lipid values
- Interactive trend charts
- Latest risk interpretation table
- Embedded exported plot images from your plot folder
- Data explorer with column selection and date filtering

## Default paths
- SQLite DB: `C:/smakrykodbs/hydra.db`
- Plot folder: `C:/temp/LogsFitnessApp/Lipid_Dashboard`

You can change both in the Streamlit sidebar.


# #########################################
# Blood Analysis Platform

A SQLite-based project scaffold for blood-test profile pipelines.

Included first profile:
- `lipidemic`

Features:
- JSON config support
- logging to `C:\temp\LogsFitnessApp\LipidLogs` or another configured folder
- one orchestrator for current and future blood profiles
- lipid metrics ETL into SQLite
- trend plots to disk

## Quick start

1. Copy `config/config.example.json` to `config/config.json`
2. Adjust the SQLite database path if needed
3. Run:

```bash
python main.py --config config/config.json --profile lipidemic
```

Run all enabled profiles:

```bash
python main.py --config config/config.json --all
```

## Expected source table

The lipidemic profile expects table `lipid_raw` with columns like:
- `Exam Date`
- `Total Cholesterol`
- `HDL`
- `LDL`
- `Triglycerides`
- `Reported Non-HDL`
- `Lp(a)`

## Outputs

- SQLite table `lipid_metrics`
- plots in configured `plot_dir`
- log file in configured `log_dir`
