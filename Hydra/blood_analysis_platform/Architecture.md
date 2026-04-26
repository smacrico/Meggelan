Below is a clean architecture document for the current **Blood Analysis Platform** implementation.

---

# Blood Analysis Platform — Architecture

## 1. Overview

The **Blood Analysis Platform** is a modular analytics pipeline built around a **SQLite database** and profile-based processing.

Current implemented profiles:

* **Lipidemic**
* **Endocrinology**
* **Liver**

The platform:

* reads raw blood test tables from SQLite
* computes derived metrics
* stores results in profile-specific metrics tables
* exports plots to profile-specific folders
* writes logs to profile-specific folders
* exposes results in **Streamlit**
* supports downstream reporting in **Power BI**

---

## 2. Execution flow

## 2.1 Entry point

Execution starts from:

```bash
python main.py --config config/config.json --profile <profile_name>
```

Examples:

```bash
python main.py --config config/config.json --profile lipidemic
python main.py --config config/config.json --profile endocrinology
python main.py --config config/config.json --profile liver
```

Or all enabled profiles:

```bash
python main.py --config config/config.json --all
```

---

## 2.2 Orchestrator flow

`main.py` calls the orchestrator.

The orchestrator:

1. loads `config/config.json`
2. initializes logging
3. determines which profile(s) to run
4. dispatches execution to the profile pipeline

Registered profile runners currently include:

* `run_lipidemic_pipeline`
* `run_endocrinology_pipeline`
* `run_liver_pipeline`

---

## 2.3 Pipeline flow per profile

Each profile follows the same ETL pattern:

### Extract

Reads raw data from the configured SQLite source table.

### Transform

Computes derived metrics, risk indicators, trend values, rolling averages, deltas, and quality flags.

### Load

Creates or updates the profile metrics table in SQLite.

### Plot export

Generates PNG plots for important metrics into the configured profile plot folder.

### Logging

Writes process logs into the configured profile log folder.

---

# 3. Project structure

```text
blood_analysis_platform/
│
├── main.py
├── config/
│   └── config.json
│
├── dashboard/
│   └── app.py
│
├── blood_analysis_platform/
│   ├── orchestrator.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── db.py
│   │   ├── logging_utils.py
│   │   └── plotting.py
│   │
│   └── profiles/
│       ├── lipidemic/
│       │   ├── extract.py
│       │   ├── transform.py
│       │   ├── load.py
│       │   └── pipeline.py
│       │
│       ├── endocrinology/
│       │   ├── extract.py
│       │   ├── transform.py
│       │   ├── load.py
│       │   └── pipeline.py
│       │
│       └── liver/
│           ├── extract.py
│           ├── transform.py
│           ├── load.py
│           └── pipeline.py
```

---

# 4. Database architecture

## 4.1 Database engine

The platform uses:

* **SQLite**
* configured in `config/config.json`

Current configured DB example:

```json
"database": {
  "sqlite_path": "C:/smakrykodbs/hydra.db"
}
```

So the physical database file is:

```text
C:\smakrykodbs\hydra.db
```

---

## 4.2 Database creation

The SQLite database file is **not created by a separate installer**.

It is created automatically by SQLite if the configured file does not already exist, when the app opens a connection.

However:

* raw source tables must exist before profile execution
* metrics tables are created automatically by the platform if missing

---

# 5. Raw source tables

These are the input tables expected in SQLite.

## 5.1 Lipidemic raw source

Table:

```text
lipid_raw
```

Contains raw lipid lab values such as:

* Exam Date
* Total Cholesterol
* HDL
* LDL
* Triglycerides
* Reported Non-HDL
* Lp(a)

---

## 5.2 Endocrinology raw source

Table:

```text
endo_raw
```

Contains raw endocrine data such as:

* Exam Date
* Glucose for calc
* Fasting Insulin
* HbA1c
* TSH
* Free T4
* Vitamin D

---

## 5.3 Liver raw source

Table:

```text
liver_raw
```

Contains raw liver-related analytes such as:

* Exam Date
* AST
* ALT
* GGT
* ALP
* Total Bilirubin
* Direct Bilirubin
* Albumin
* LDH

---

# 6. Metrics tables created by the platform

These are created and maintained automatically by the pipeline loaders.

## 6.1 Lipid metrics table

```text
lipid_metrics
```

Purpose:

* stores lipid raw carry-forward values
* stores derived lipid metrics
* stores trend columns
* stores interpretation/risk columns

Examples of stored metrics:

* total_cholesterol
* hdl
* ldl_final
* triglycerides
* non_hdl_final
* tc_hdl_ratio
* ldl_hdl_ratio
* tg_hdl_ratio
* aip
* remnant_cholesterol
* risk indicators
* previous values
* delta values
* percent change
* rolling3 values

---

## 6.2 Endocrinology metrics table

```text
endo_metrics
```

Purpose:

* stores endocrine raw values
* stores derived endocrine metrics
* stores trend columns
* stores categorical interpretations

Examples:

* glucose_for_calc
* fasting_insulin
* hba1c
* homa_ir
* quicki
* eag_mgdl
* tsh
* free_t4
* tsh_free_t4_ratio
* vitamin_d_25_oh
* vitamin_d_status
* homa_ir_interpretation
* prev / delta / pct_change / rolling3 fields

---

## 6.3 Liver metrics table

```text
liver_metrics
```

Purpose:

* stores liver raw values
* stores liver derived metrics
* stores trend columns
* stores pattern classifications

Examples:

* ast
* alt
* ggt
* alp
* total_bilirubin
* direct_bilirubin
* indirect_bilirubin
* ast_alt_ratio
* direct_total_bilirubin_pct
* ast_alt_pattern
* bilirubin_pattern
* prev / delta / pct_change / rolling3 fields

---

# 7. Configuration architecture

All runtime behavior is controlled from:

```text
config/config.json
```

Main sections:

* `app_name`
* `database`
* `paths`
* `profiles`

Each profile defines:

* `enabled`
* `source_table`
* `target_table`
* `date_column`
* `log_dir`
* `plot_dir`
* `columns`

This allows:

* flexible remapping of raw column names
* profile-specific log locations
* profile-specific plot export locations

---

# 8. Logging architecture

## 8.1 Where logs are written

Logging is profile-driven.

Each profile uses its own configured folder.

### Lipidemic logs

```text
C:\temp\LogsFitnessApp\LipidLogs\
```

### Endocrinology logs

```text
C:\temp\LogsFitnessApp\EndoLogs\
```

### Liver logs

```text
C:\temp\LogsFitnessApp\LiverLogs\
```

Main log file name:

```text
blood_analysis_platform.log
```

So full examples are:

```text
C:\temp\LogsFitnessApp\LipidLogs\blood_analysis_platform.log
C:\temp\LogsFitnessApp\EndoLogs\blood_analysis_platform.log
C:\temp\LogsFitnessApp\LiverLogs\blood_analysis_platform.log
```

---

## 8.2 What logs contain

Logs typically record:

* orchestrator start
* selected profiles
* source table load
* record count loaded
* metric computation completion
* upsert completion
* plot export completion
* warnings if source table is empty
* exceptions / failures

Example messages:

* starting orchestrator
* running profile
* loading source table
* saved plots into path
* no rows found in source table

---

# 9. Plot output architecture

Each profile exports plot PNGs to its own configured folder.

## 9.1 Lipidemic plot folder

```text
C:\temp\LogsFitnessApp\Lipid_Dashboard\
```

Examples:

* `total_cholesterol_trend.png`
* `hdl_trend.png`
* `ldl_final_trend.png`
* `triglycerides_trend.png`
* `non_hdl_final_trend.png`
* `aip_trend.png`
* `remnant_cholesterol_trend.png`

---

## 9.2 Endocrinology plot folder

Configured as:

```text
C:\temp\LogsFitnessApp\Endo_Dasboards\
```

Examples:

* `glucose_for_calc_trend.png`
* `fasting_insulin_trend.png`
* `hba1c_trend.png`
* `homa_ir_trend.png`
* `quicki_trend.png`
* `eag_mgdl_trend.png`
* `tsh_trend.png`
* `free_t4_trend.png`
* `tsh_free_t4_ratio_trend.png`
* `vitamin_d_25_oh_trend.png`

---

## 9.3 Liver plot folder

```text
C:\temp\LogsFitnessApp\Liver_Dashboard\
```

Examples:

* `ast_trend.png`
* `alt_trend.png`
* `ggt_trend.png`
* `alp_trend.png`
* `total_bilirubin_trend.png`
* `direct_bilirubin_trend.png`
* `indirect_bilirubin_trend.png`
* `ast_alt_ratio_trend.png`
* `direct_total_bilirubin_pct_trend.png`
* `albumin_trend.png`
* `ldh_trend.png`

---

# 10. Streamlit dashboard architecture

## 10.1 Entry point

Dashboard app:

```text
dashboard/app.py
```

Run with:

```bash
streamlit run dashboard/app.py
```

---

## 10.2 Configuration source

The dashboard loads the same:

```text
config/config.json
```

This means:

* same database path
* same profile table names
* same plot directories

---

## 10.3 Dashboard data sources

Reads from:

* `lipid_metrics`
* `endo_metrics`
* `liver_metrics`

Displays:

* latest KPI cards
* interpretation fields
* trend charts
* exported plot images
* data explorer tables

---

# 11. Power BI architecture

Power BI is downstream from the SQLite platform.

## Data sources

* `lipid_metrics`
* `endo_metrics`
* optionally `liver_metrics`

## Model elements

* fact tables from metrics tables
* `Dim_Date`
* measure tables
* calculation group for trend view
* KPI color measures
* Python visuals

Power BI does not create metrics.
It consumes metrics already generated by the platform.

---

# 12. Derived metrics execution responsibility

## In Python pipeline

All medical/analytical transformation logic is executed in Python before data reaches dashboards.

That includes:

* derived formulas
* category assignment
* trend calculations
* rolling windows
* quality flags

## In Streamlit / Power BI

Mostly presentation, filtering, trend display, and KPI summarization.

---

# 13. Profile-specific execution summary

## 13.1 Lipidemic execution

Source:

```text
lipid_raw
```

Target:

```text
lipid_metrics
```

Logs:

```text
C:\temp\LogsFitnessApp\LipidLogs\
```

Plots:

```text
C:\temp\LogsFitnessApp\Lipid_Dashboard\
```

Main derived metrics:

* Non-HDL
* TC/HDL
* LDL/HDL
* TG/HDL
* AIP
* Remnant Cholesterol

---

## 13.2 Endocrinology execution

Source:

```text
endo_raw
```

Target:

```text
endo_metrics
```

Logs:

```text
C:\temp\LogsFitnessApp\EndoLogs\
```

Plots:

```text
C:\temp\LogsFitnessApp\Endo_Dasboards\
```

Main derived metrics:

* HOMA-IR
* QUICKI
* eAG
* TSH / Free T4 Ratio
* Vitamin D Status

---

## 13.3 Liver execution

Source:

```text
liver_raw
```

Target:

```text
liver_metrics
```

Logs:

```text
C:\temp\LogsFitnessApp\LiverLogs\
```

Plots:

```text
C:\temp\LogsFitnessApp\Liver_Dashboard\
```

Main derived metrics:

* AST / ALT Ratio
* Indirect Bilirubin
* Direct / Total Bilirubin %

---

# 14. Outputs produced by the platform

The platform currently produces the following output categories.

## 14.1 Database outputs

Inside SQLite:

* `lipid_metrics`
* `endo_metrics`
* `liver_metrics`

## 14.2 Log outputs

Per-profile:

* process logs in configured log folders

## 14.3 Plot outputs

Per-profile:

* PNG metric trend plots in configured plot folders

## 14.4 Dashboard outputs

Runtime visualization via:

* Streamlit app

## 14.5 Reporting outputs

Downstream:

* Power BI model and report pages
* Python visuals inside Power BI

---

# 15. Current execution dependencies

The platform depends on:

* Python
* pandas
* numpy
* matplotlib
* sqlite3
* streamlit
* Power BI for downstream analytics
* Tabular Editor for model automation

---

# 16. Operational summary

## What is executed

A profile pipeline:

* loads raw lab data
* computes profile-specific derived metrics
* upserts results into SQLite
* exports profile plots
* writes logs

## What database is used

* SQLite database file:

  * `C:\smakrykodbs\hydra.db`

## What tables exist

### Raw input tables

* `lipid_raw`
* `endo_raw`
* `liver_raw`

### Computed metrics tables

* `lipid_metrics`
* `endo_metrics`
* `liver_metrics`

## Where logs are kept

* `C:\temp\LogsFitnessApp\LipidLogs\`
* `C:\temp\LogsFitnessApp\EndoLogs\`
* `C:\temp\LogsFitnessApp\LiverLogs\`

## Where plots are kept

* `C:\temp\LogsFitnessApp\Lipid_Dashboard\`
* `C:\temp\LogsFitnessApp\Endo_Dasboards\`
* `C:\temp\LogsFitnessApp\Liver_Dashboard\`

## Where dashboard code lives

* `dashboard/app.py`

## Where configuration is stored

* `config/config.json`

---

If you want, I can turn this into a polished `README.md` section ready to paste into your repo.
