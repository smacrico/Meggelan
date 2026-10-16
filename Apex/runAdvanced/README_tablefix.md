# Enhanced pipeline table-load fix

This package fixes the `Loaded 0 rows` issue.

Root cause:
- `main_enhanced.py` was still importing `repository.py` and `plots.py`.
- The repository table discovery could select an existing but empty `running_sessions` table before the populated enhanced table.
- The enhanced raw table can be named `adv_running_sessions` or `adv_sessions`; both are now supported.

Use:
```bash
python main_enhanced.py
```

The repository now writes calculated outputs to:
- `adv_training_log`
- `adv_monthly_summaries`
- `adv_metrics_breakdown`
