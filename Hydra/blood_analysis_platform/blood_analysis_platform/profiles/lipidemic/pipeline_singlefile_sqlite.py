
"""
SQLite-ready adaptation of the original blood_analysis_lipid_pipeline.py.

This file keeps the same spirit as the original file but is adapted for:
- SQLite
- config + logger injection
- orchestrator execution
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from blood_analysis_platform.core.db import sqlite_connection
from blood_analysis_platform.core.plotting import save_time_series_plot
from blood_analysis_platform.profiles.lipidemic.extract import load_lipid_raw
from blood_analysis_platform.profiles.lipidemic.load import ensure_target_table, upsert_lipid_metrics
from blood_analysis_platform.profiles.lipidemic.transform import compute_lipid_metrics


class LipidMetricsPipeline:
    def __init__(self, config, logger):
        self.config = config
        self.logger = logger
        profile_config = config.profile("lipidemic")
        self.source_table = profile_config.get("source_table", "lipid_raw")
        self.target_table = profile_config.get("target_table", "lipid_metrics")
        self.plot_dir = Path(profile_config.get("plot_dir", config.plot_dir)) / "lipidemic"

    def load_raw(self) -> pd.DataFrame:
        with sqlite_connection(self.config.sqlite_path) as conn:
            return load_lipid_raw(conn, self.source_table)

    def compute_metrics(self, raw_df: pd.DataFrame) -> pd.DataFrame:
        return compute_lipid_metrics(raw_df)

    def ensure_target_table(self) -> None:
        with sqlite_connection(self.config.sqlite_path) as conn:
            ensure_target_table(conn, self.target_table)

    def upsert_metrics(self, metrics_df: pd.DataFrame) -> None:
        with sqlite_connection(self.config.sqlite_path) as conn:
            upsert_lipid_metrics(conn, metrics_df, self.target_table)

    def produce_plots(self, metrics_df: pd.DataFrame) -> None:
        plot_specs = [
            ("total_cholesterol", "Total Cholesterol (mg/dL)"),
            ("hdl", "HDL (mg/dL)"),
            ("ldl_final", "LDL Final (mg/dL)"),
            ("triglycerides", "Triglycerides (mg/dL)"),
            ("non_hdl_final", "Non-HDL (mg/dL)"),
            ("tc_hdl_ratio", "TC/HDL Ratio"),
            ("ldl_hdl_ratio", "LDL/HDL Ratio"),
            ("tg_hdl_ratio", "TG/HDL Ratio"),
            ("aip", "AIP"),
            ("remnant_cholesterol", "Remnant Cholesterol (mg/dL)"),
            ("lpa", "Lp(a)"),
        ]
        for col, title in plot_specs:
            save_time_series_plot(metrics_df, "exam_date", col, title, self.plot_dir / f"{col}_trend.png")

    def run(self) -> pd.DataFrame:
        raw_df = self.load_raw()
        if raw_df.empty:
            self.logger.warning("No lipidemic rows found in source table '%s'", self.source_table)
            return raw_df
        metrics_df = self.compute_metrics(raw_df)
        self.ensure_target_table()
        self.upsert_metrics(metrics_df)
        self.produce_plots(metrics_df)
        return metrics_df


def run_lipidemic_pipeline(config, logger) -> pd.DataFrame:
    return LipidMetricsPipeline(config, logger).run()
