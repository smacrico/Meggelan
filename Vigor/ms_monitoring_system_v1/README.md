
# MS Monitoring System v1

This package is a starter system for personal Multiple Sclerosis monitoring using:
- HRV and resting heart rate
- sleep
- activity
- subjective symptoms
- relapse events
- treatment history
- Power BI / Python dashboard logic
- weekly report generation

## Clinical safety
This system is not a diagnostic device. It is designed to summarize trends and support conversations with a neurologist. A possible MS relapse usually involves new or worsening neurological symptoms lasting >24 hours and not explained by infection, fever, or heat exposure.

## How to use

1. Fill the CSV files in `data_templates/`.
2. Run:

```bash
python src/ms_monitoring_pipeline.py
```

3. Outputs appear in `reports/`:
- `processed_daily_metrics.csv`
- `weekly_ms_report.md`

## Recommended cadence

Daily:
- RMSSD / HRV
- resting HR
- sleep duration and quality
- fatigue score
- core symptoms

Weekly:
- review trend report
- identify sustained deviations
- record notes for neurologist

Monthly:
- update baseline
- review relapse/treatment timeline
- compare MRI/labs/clinical notes if available
