from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from blood_analysis_platform.core.db import sqlite_connection
from blood_analysis_platform.profiles.endocrinology.extract import load_endo_raw
from blood_analysis_platform.profiles.endocrinology.transform import compute_endocrinology_metrics
from blood_analysis_platform.profiles.endocrinology.load import upsert_endo_metrics


def create_endo_plots(metrics_df: pd.DataFrame, plot_dir: str) -> None:
    out_dir = Path(plot_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if "exam_date" not in metrics_df.columns:
        return

    plot_specs = [
        ("glucose_for_calc", "Glucose for Calc"),
        ("fasting_insulin", "Fasting Insulin"),
        ("hba1c", "HbA1c"),
        ("homa_ir", "HOMA-IR"),
        ("quicki", "QUICKI"),
        ("eag_mgdl", "Estimated Average Glucose"),
        ("tsh", "TSH"),
        ("free_t4", "Free T4"),
        ("tsh_free_t4_ratio", "TSH / Free T4 Ratio"),
        ("vitamin_d_25_oh", "Vitamin D 25-OH"),
    ]

    df = metrics_df.copy()
    df["exam_date"] = pd.to_datetime(df["exam_date"], errors="coerce")
    df = df.sort_values("exam_date")

    for col, title in plot_specs:
        if col not in df.columns:
            continue

        subset = df[["exam_date", col]].dropna()
        if subset.empty:
            continue

        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(subset["exam_date"], subset[col], marker="o")
        ax.set_title(title)
        ax.set_xlabel("Exam Date")
        ax.set_ylabel(title)
        ax.grid(True, alpha=0.3)
        fig.autofmt_xdate()
        fig.tight_layout()
        fig.savefig(out_dir / f"{col}_trend.png", dpi=150)
        plt.close(fig)


class EndocrinologyMetricsPipeline:
    def __init__(self, config, logger) -> None:
        self.config = config
        self.logger = logger

    def run(self) -> None:
        profile_config = self.config.profile("endocrinology")
        source_table = profile_config.get("source_table", "endo_raw")
        target_table = profile_config.get("target_table", "endo_metrics")
        plot_dir = profile_config.get("plot_dir", self.config.plot_dir)

        with sqlite_connection(self.config.sqlite_path) as conn:
            self.logger.info(
                "Loading endocrinology source table '%s' from %s",
                source_table,
                self.config.sqlite_path,
            )
            raw_df = load_endo_raw(conn=conn, source_table=source_table, profile_config=profile_config)

            if raw_df.empty:
                self.logger.warning("No endocrinology records found in source table '%s'.", source_table)
                return

            metrics_df = compute_endocrinology_metrics(raw_df=raw_df, profile_config=profile_config)
            upsert_endo_metrics(conn=conn, df=metrics_df, target_table=target_table)

        create_endo_plots(metrics_df=metrics_df, plot_dir=plot_dir)
        self.logger.info("Saved endocrinology plots into %s", plot_dir)


def run_endocrinology_pipeline(config, logger) -> None:
    EndocrinologyMetricsPipeline(config=config, logger=logger).run()