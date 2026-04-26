from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="dev", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    athlete_timezone: str = Field(default="Europe/Athens", alias="ATHLETE_TIMEZONE")

    database_url: str = Field(
        default="postgresql+psycopg://garmin:garmin@localhost:5432/garmin",
        alias="DATABASE_URL",
    )

    garmin_import_path: Path = Field(default=Path("./data/imports"), alias="GARMIN_IMPORT_PATH")
    html_export_path: Path = Field(default=Path("./data/exports"), alias="HTML_EXPORT_PATH")

    garmin_activities_db: Path = Field(default=Path("./data/sqlite/garmin_activities.sqlite"), alias="GARMIN_ACTIVITIES_DB")
    garmin_run_db: Path = Field(default=Path("./data/sqlite/garmin_run.sqlite"), alias="GARMIN_RUN_DB")
    hrv_db: Path = Field(default=Path("./data/sqlite/hrv.sqlite"), alias="HRV_DB")

    enable_bootstrap: bool = Field(default=False, alias="ENABLE_BOOTSTRAP")
    pipeline_lock_key: str = Field(default="garmin-main", alias="PIPELINE_LOCK_KEY")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.garmin_import_path.mkdir(parents=True, exist_ok=True)
    settings.html_export_path.mkdir(parents=True, exist_ok=True)
    return settings
