from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict


@dataclass
class AppConfig:
    app_name: str
    sqlite_path: str
    log_dir: str
    plot_dir: str
    profiles: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    @classmethod
    def from_file(cls, path: str | Path) -> "AppConfig":
        config_path = Path(path)
        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")

        with config_path.open("r", encoding="utf-8") as f:
            raw = json.load(f)

        app_name = raw.get("app_name", "Blood Analysis Platform")

        database = raw.get("database", {})
        paths = raw.get("paths", {})
        profiles = raw.get("profiles", {})

        sqlite_path = database.get("sqlite_path")
        log_dir = paths.get("log_dir")
        plot_dir = paths.get("plot_dir")

        if not sqlite_path:
            raise ValueError("Missing required config key: database.sqlite_path")
        if not log_dir:
            raise ValueError("Missing required config key: paths.log_dir")
        if not plot_dir:
            raise ValueError("Missing required config key: paths.plot_dir")

        return cls(
            app_name=app_name,
            sqlite_path=sqlite_path,
            log_dir=log_dir,
            plot_dir=plot_dir,
            profiles=profiles,
        )

    def profile(self, name: str) -> Dict[str, Any]:
        return self.profiles.get(name, {})