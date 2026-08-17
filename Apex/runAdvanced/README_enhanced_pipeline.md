# Enhanced Running Analytics Pipeline

Use these files together. They are wired to import each other with the `_enhanced` module names.

Recommended run order:

1. `python createRunAnalDB_v8_enhanced.py`
2. `python main_enhanced.py`
3. `streamlit run streamlit_app_enhanced.py`

SQLite tables used by the enhanced pipeline:

- `adv_running_sessions`
- `adv_training_log`
- `adv_monthly_summaries`
- `adv_metrics_breakdown`

The repository also falls back to `running_sessions` if `adv_running_sessions` is not present.
