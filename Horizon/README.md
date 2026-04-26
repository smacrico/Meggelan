# Garmin + HRV Analytics Platform

Production-oriented starter repository for:

- Garmin export ingestion
- running metrics analysis
- HRV daily metrics analysis
- PostgreSQL storage
- Streamlit dashboard
- Railway deployment with:
  - `dashboard-web`
  - `pipeline-cron`
  - `Postgres`

## Quick start (local)

1. Create a virtual environment and install dependencies.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL locally.
4. Run migrations.
5. Bootstrap historical SQLite data if available.
6. Start Streamlit.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env

alembic upgrade head
python scripts/bootstrap_from_sqlite.py
streamlit run app/dashboard/streamlit_app.py
```

## Railway services

- `dashboard-web` uses `deploy/dashboard/Dockerfile`
- `pipeline-cron` uses `deploy/pipeline/Dockerfile`
- `Postgres` is Railway managed PostgreSQL

## Manual pipeline run

```bash
python scripts/run_pipeline.py
```

## Notes

This scaffold is intentionally generic. The SQLite bootstrap logic includes adaptable mapping hooks so you can connect it to your exact Garmin/HRV local schemas.
