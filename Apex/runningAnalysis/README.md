# Running Analysis Code Bundle

This bundle contains a split version of the running analysis app:

- `repository.py` — SQLite access and persistence
- `metrics.py` — derived metrics, scoring, and summary logic
- `plots.py` — matplotlib visualizations
- `main.py` — orchestration entry point

## Assumptions

- `time` in the database is stored in **minutes**
- `distance` is in **km**
- `avg_speed` and `max_speed` are in **km/h**

## Run

From inside the `running_analysis` folder:

```bash
python main.py
```

## Notes

Update `db_path` and `output_dir` in `main.py` if needed for your environment.
