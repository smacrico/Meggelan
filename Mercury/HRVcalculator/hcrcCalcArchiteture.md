Here’s the architecture documentation for the current `garmin_hrv_batch_analysis_v4.py` script.

# Overview

The script is a **batch HRV analytics pipeline** for Garmin FIT files. It:

* scans a folder for `.fit` files
* extracts HRV beat-to-beat data from Garmin developer field `hrv btb (ms)`
* derives per-session HRV metrics
* computes TRIMP-based training load
* derives daily, weekly, and monthly summaries
* writes CSV outputs
* generates chart images
* stores summary aggregates in SQLite (`hydra.db` or configured DB path)

---

# Execution flow

## 1. Script startup

Execution begins in:

```python
if __name__ == "__main__":
    main()
```

`main()` parses command-line arguments, loads athlete configuration, scans the input folder, processes FIT files, computes summaries, generates outputs, and writes to SQLite.

---

## 2. Command-line inputs

The script expects:

* `input_path`: folder containing `.fit` files
* optional `--config`: JSON athlete config file
* optional `--athlete`: athlete profile name inside config
* optional `--output-dir`: custom output directory
* optional `--db-path`: SQLite database location
* optional window and step parameters for rolling HRV
* optional `--debug-record-fields`

Example:

```bash
python garmin_hrv_batch_analysis_v4.py input_folder --config athlete_config.json --athlete stelios --db-path c:/smakrykoDBs/Hydra.db
```

---

## 3. Athlete config loading

Function:

```python
load_config(config_path, athlete_name)
```

Purpose:

* reads the JSON config file
* merges `default` settings with athlete-specific overrides
* returns:

  * `resting_hr`
  * `max_hr`
  * `sex`

These values influence:

* TRIMP calculation
* fatigue/readiness quality

---

## 4. FIT file discovery

Inside `main()`:

```python
fit_files = sorted(input_path.rglob("*.fit"))
```

This recursively scans the input folder and all subfolders for `.fit` files.

---

## 5. Per-file processing

Each FIT file is processed by:

```python
process_file(...)
```

That function performs:

### a. Record extraction

Calls:

```python
extract_rr_points_and_hr(fit_path, debug_record_fields)
```

This reads Garmin FIT `record` messages and extracts:

* timestamp
* heart rate
* HRV beat-to-beat values from `hrv btb (ms)`

Outputs:

* `rr_points`: normalized RR interval series
* `hr_rows`: heart-rate time series

### b. HRV metric calculation

Calls:

```python
compute_metrics(rr_df["rr_ms"].tolist())
```

Per-session metrics:

* RMSSD
* SDNN
* pNN50
* mean RR
* mean HR
* min RR
* max RR

### c. Rolling HRV windows

Calls:

```python
rolling_hrv(rr_points, window_seconds, step_seconds)
```

This creates rolling HRV metrics across the session.

### d. TRIMP load

Calls:

* `estimate_resting_hr(...)`
* `estimate_max_hr(...)`
* `compute_trimp(...)`

TRIMP is computed from heart rate reserve using Banister-style weighting.

### e. Per-file CSV outputs

For each FIT file, the script writes:

* `<stem>_rr.csv`
* `<stem>_rolling.csv`
* `<stem>_summary.csv`

These go to the output directory.

---

# Data processing layers

## Session layer

Per FIT file:

* session HRV metrics
* session TRIMP
* session duration
* session metadata

## Aggregate layer

After all sessions are processed, the script builds:

### Daily summaries

Created by:

```python
make_daily_trends(summary_df)
```

### Weekly summaries

Created by:

```python
make_weekly_monthly_trends(summary_df)
```

### Monthly summaries

Also created by `make_weekly_monthly_trends(summary_df)`

## Modeling layer

The script then applies:

### Fatigue model

Function:

```python
fatigue_score_model(summary_df)
```

Factors:

* HRV suppression vs rolling baseline
* acute/chronic TRIMP ratio
* HR elevation vs rolling baseline

Outputs:

* `fatigue_score`
* `fatigue_label`

### Readiness model

Function:

```python
combined_readiness_model(summary_df)
```

Factors:

* HRV support
* inverse fatigue
* training load balance

Outputs:

* `readiness_score`

---

# Database architecture

## Database created

SQLite database file:

```text
hydra.db
```

Or the path given by:

```bash
--db-path
```

Default in your script:

```python
Path("c:/smakrykoDBs/Hydra.db")
```

So unless overridden, the database is created at:

```text
c:/smakrykoDBs/Hydra.db
```

---

## Database engine

The script uses Python’s built-in:

```python
sqlite3
```

Connection setup:

```python
connect_db(db_path)
```

This enables:

* WAL journal mode
* foreign keys

Though there are currently no foreign-key relationships defined between tables.

---

## Tables created

### 1. `daily_summary`

Primary key:

* `summary_date`

Columns:

* `summary_date` TEXT
* `sessions` INTEGER
* `avg_rmssd` REAL
* `avg_sdnn` REAL
* `avg_mean_hr` REAL
* `total_trimp` REAL
* `avg_fatigue` REAL
* `avg_readiness` REAL
* `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

Purpose:

* one row per calendar day

---

### 2. `weekly_summary`

Primary key:

* `week`

Columns:

* `week` TEXT
* `sessions` INTEGER
* `avg_rmssd` REAL
* `avg_sdnn` REAL
* `avg_mean_hr` REAL
* `total_trimp` REAL
* `avg_fatigue` REAL
* `avg_readiness` REAL
* `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

Purpose:

* one row per week period string, e.g. `2026-04-06/2026-04-12`

---

### 3. `monthly_summary`

Primary key:

* `month`

Columns:

* `month` TEXT
* `sessions` INTEGER
* `avg_rmssd` REAL
* `avg_sdnn` REAL
* `avg_mean_hr` REAL
* `total_trimp` REAL
* `avg_fatigue` REAL
* `avg_readiness` REAL
* `created_at` TEXT DEFAULT CURRENT_TIMESTAMP

Purpose:

* one row per month, e.g. `2026-04`

---

## DB write behavior

Function:

```python
save_summaries_to_hydra_db(...)
```

This:

1. creates the tables if they do not exist
2. upserts daily summary rows
3. upserts weekly summary rows
4. upserts monthly summary rows

Upsert logic uses:

```sql
ON CONFLICT(key) DO UPDATE
```

So rerunning the script:

* does not duplicate summary rows
* refreshes matching daily/weekly/monthly periods

---

# Output locations

## 1. Output directory

The main output folder is:

```python
output_dir = args.output_dir or (input_path / "hrv_output")
```

So by default, outputs go to:

```text
<input_folder>/hrv_output/
```

If `--output-dir` is passed, they go there instead.

---

## 2. Per-file outputs

For each FIT file:

* `<file_stem>_rr.csv`
* `<file_stem>_rolling.csv`
* `<file_stem>_summary.csv`

Location:

* `output_dir`

Example:

```text
input_folder/hrv_output/demoHRV_rr.csv
input_folder/hrv_output/demoHRV_rolling.csv
input_folder/hrv_output/demoHRV_summary.csv
```

---

## 3. Aggregate CSV outputs

Written in `output_dir`:

* `batch_summary_with_fatigue_readiness_trimp.csv`
* `daily_hrv_trends.csv`
* `weekly_hrv_trends.csv`
* `monthly_hrv_trends.csv`

Purpose:

* consolidated reporting
* human-readable exports
* easy import into Power BI, Excel, or pandas

---

## 4. Chart outputs

Created by:

```python
generate_charts(...)
```

Location:

```text
output_dir/charts/
```

Files created:

* `01_rmssd_over_time.png`
* `02_fatigue_over_time.png`
* `03_readiness_over_time.png`
* `04_trimp_over_time.png`
* `05_trimp_vs_rmssd.png`
* `06_weekly_rmssd.png`
* `07_weekly_fatigue_readiness.png`
* `08_monthly_trimp.png`

---

# Logging behavior

## Current state

The script does **not** implement structured logging to a file.

It uses plain console output via `print()`.

So logs are currently kept only in:

* the terminal session
* console history
* whatever shell redirection you use externally

Examples of console output:

* file processing progress
* skip notices
* config used
* per-file summary
* daily/weekly/monthly summary tables
* output paths
* DB path confirmation

---

## Log persistence

By default:

* **no `.log` file is created**
* **no logs are stored in the database**
* **no rotating log handler is configured**

If you want persistent logs, that would need an additional logging layer using Python’s `logging` module.

---

# Internal function architecture

## Input/config functions

* `load_config(...)`

## FIT parsing functions

* `extract_rr_points_and_hr(...)`
* `normalize_field_name(...)`
* `is_hrv_btb_field(...)`
* `fit_timestamp_to_datetime(...)`
* `flatten_rr_value(...)`
* `safe_float(...)`
* `normalize_rr_to_seconds(...)`

## HRV computation functions

* `compute_metrics(...)`
* `rolling_hrv(...)`

## Load/TRIMP functions

* `estimate_resting_hr(...)`
* `estimate_max_hr(...)`
* `compute_trimp(...)`

## Session processing

* `process_file(...)`

## Trend/model functions

* `add_trend_fields(...)`
* `fatigue_score_model(...)`
* `combined_readiness_model(...)`
* `make_daily_trends(...)`
* `make_weekly_monthly_trends(...)`

## Database functions

* `connect_db(...)`
* `create_summary_tables(...)`
* `upsert_dataframe(...)`
* `save_summaries_to_hydra_db(...)`

## Visualization

* `save_plot(...)`
* `generate_charts(...)`

## Orchestration

* `main()`

---

# Execution sequence summary

The runtime order is:

1. parse CLI args
2. load athlete config
3. validate input folder
4. discover `.fit` files
5. create output directory
6. process each FIT file

   * parse record messages
   * extract HRV + HR
   * compute metrics
   * compute TRIMP
   * save per-file CSVs
7. combine all session rows into `summary_df`
8. compute rolling baselines and derived fields
9. compute fatigue and readiness
10. build daily, weekly, monthly summaries
11. save aggregate CSVs
12. upsert summary tables into SQLite
13. generate charts
14. print summaries and output paths

---

# Artifacts created by the script

## Files

* per-session CSV files
* aggregate CSV files
* PNG chart files
* SQLite DB file

## Database

* `daily_summary`
* `weekly_summary`
* `monthly_summary`

## Console output

* progress and summaries

---

# What is not currently created

The script does **not** currently create:

* a raw session table in SQLite
* a file-processing audit table
* error log files
* JSON outputs
* PDF reports
* Excel workbooks
* REST API endpoints
* background services or schedulers

---

# Recommended next improvements

The most useful architectural next steps would be:

* add a `session_summary` SQLite table
* add a `processing_log` SQLite table
* add file-based logging with timestamps
* add a `failed_files` report
* add chart metadata or report manifest table

If you want, I can turn this into a proper `README.md` or technical design document format.



# Updated
Execution model

Each run will now:

generate a unique run_id
log processing events to:
console
log file
SQLite processing_log
write per-session results into session_summary
write aggregates into daily/weekly/monthly tables
record every generated chart in chart_metadata
record every output artifact in report_manifest
export failed files into failed_files.csv


# New SQLite tables
session_summary
processing_log
chart_metadata
report_manifest
# New files
hrv_pipeline.log
failed_files.csv
report_manifest.csv

# New SQLite tables
session_summary
processing_log
chart_metadata
report_manifest
New files
hrv_pipeline.log
failed_files.csv
report_manifest.csv