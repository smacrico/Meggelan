# Fix for empty enhanced metrics in adv_metrics_breakdown

The problem was caused by mixed imports/table names:
- `main_enhanced.py` was still importing `repository` and `plots`
- `metrics_enhanced.py` was still importing `repository`
- `repository_enhanced.py` defaulted to non-`adv_` output tables

This package fixes the wiring:
- `main_enhanced.py` -> `repository_enhanced`, `plots_enhanced`
- `metrics_enhanced.py` -> `repository_enhanced`
- output tables -> `adv_training_log`, `adv_monthly_summaries`, `adv_metrics_breakdown`

Run order:
1. Run `createRunAnalDB_v8_enhanced.py`
2. Run `main_enhanced.py`
3. Open Streamlit with `streamlit_app_enhanced_dashboard.py`

Note: if your DB contains `adv_metrics_brakedown`, that is a typo. Use `adv_metrics_breakdown`.
