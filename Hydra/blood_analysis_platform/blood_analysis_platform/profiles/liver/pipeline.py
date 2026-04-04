from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd

from blood_analysis_platform.core.db import sqlite_connection
from blood_analysis_platform.profiles.liver.extract import load_liver_raw
from blood_analysis_platform.profiles.liver.transform import compute_liver_metrics
from blood_analysis_platform.profiles.liver.load import upsert_liver_metrics


def create_liver_plots(metrics_df: pd.DataFrame, plot_dir: str) -> None:
    out_dir = Path(plot_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    if "exam_date" not in metrics_df.columns:
        return

    plot_specs = [
        ("ast", "AST"),
        ("alt", "ALT"),
        ("ggt", "GGT"),
        ("alp", "ALP"),
        ("total_bilirubin", "Total Bilirubin"),
        ("direct_bilirubin", "Direct Bilirubin"),
        ("indirect_bilirubin", "Indirect Bilirubin"),
        ("direct_total_bilirubin_pct", "Direct / Total Bilirubin %"),
        ("ast_alt_ratio", "AST / ALT Ratio"),
        ("albumin", "Albumin"),
        ("ldh", "LDH"),
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


class LiverMetricsPipeline:
    def __init__(self, config, logger) -> None:
        self.config = config
        self.logger = logger

    def run(self) -> None:
        profile_config = self.config.profile("liver")
        source_table = profile_config.get("source_table", "liver_raw")
        target_table = profile_config.get("target_table", "liver_metrics")
        plot_dir = profile_config.get("plot_dir", self.config.plot_dir)

        with sqlite_connection(self.config.sqlite_path) as conn:
            self.logger.info(
                "Loading liver source table '%s' from %s",
                source_table,
                self.config.sqlite_path,
            )
            raw_df = load_liver_raw(conn=conn, source_table=source_table, profile_config=profile_config)

            if raw_df.empty:
                self.logger.warning("No liver records found in source table '%s'.", source_table)
                return

            metrics_df = compute_liver_metrics(raw_df=raw_df, profile_config=profile_config)
            upsert_liver_metrics(conn=conn, df=metrics_df, target_table=target_table)

        create_liver_plots(metrics_df=metrics_df, plot_dir=plot_dir)
        self.logger.info("Saved liver plots into %s", plot_dir)


def run_liver_pipeline(config, logger) -> None:
    LiverMetricsPipeline(config=config, logger=logger).run()