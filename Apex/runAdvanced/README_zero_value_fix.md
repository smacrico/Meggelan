# Enhanced zero-value fix

This package fixes the reason enhanced metrics were being inserted as 0/blank even with valid sessions.

Main fixes:
- `metrics_enhanced.py` imports `repository_enhanced`.
- Daily load metrics merge by normalized calendar day (`session_day`), not exact timestamp.
  Garmin/Artemis dates include time-of-day, while daily rolling rows are midnight dates.
- `aerobic_decoupling_pct` falls back to `cardiac_drift` when first/second-half fields are missing.
- `repository_enhanced.py` selects the first populated raw table from:
  `adv_running_sessions`, `adv_sessions`, `running_sessions`.
- Outputs go to:
  `adv_training_log`, `adv_monthly_summaries`, `adv_metrics_breakdown`.

Run:
```bash
python main_enhanced.py
```

Before checking the new breakdown, clear old bad rows if needed:
```sql
DELETE FROM adv_metrics_breakdown;
DELETE FROM adv_training_log;
DELETE FROM adv_monthly_summaries;
```
