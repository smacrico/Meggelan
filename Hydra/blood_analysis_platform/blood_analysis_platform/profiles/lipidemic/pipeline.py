
from __future__ import annotations

from pathlib import Path

import pandas as pd

from blood_analysis_platform.core.db import sqlite_connection
from blood_analysis_platform.core.plotting import save_time_series_plot
from blood_analysis_platform.profiles.lipidemic.extract import load_lipid_raw
from blood_analysis_platform.profiles.lipidemic.load import ensure_target_table, upsert_lipid_metrics
from blood_analysis_platform.profiles.lipidemic.transform import compute_lipid_metrics


class LipidMetricsPipeline:
    def __init__(self, config, logger) -> None:
        self.config = config
        self.logger = logger
        self.profile_config = config.profile("lipidemic")
        self.source_table = self.profile_config.get("source_table", "lipid_raw")
        self.target_table = self.profile_config.get("target_table", "lipid_metrics")
        self.plot_dir = Path(self.profile_config.get("plot_dir", config.plot_dir)) / "lipidemic"

    def extract(self) -> pd.DataFrame:
        with sqlite_connection(self.config.sqlite_path) as conn:
            self.logger.info("Reading lipidemic source table '%s' from SQLite database", self.source_table)
            return load_lipid_raw(conn=conn, source_table=self.source_table)

    def transform(self, raw_df: pd.DataFrame) -> pd.DataFrame:
        self.logger.info("Computing lipidemic derived metrics")
        return compute_lipid_metrics(raw_df)

    def load(self, metrics_df: pd.DataFrame) -> None:
        with sqlite_connection(self.config.sqlite_path) as conn:
            ensure_target_table(conn=conn, target_table=self.target_table)
            upsert_lipid_metrics(conn=conn, df=metrics_df, target_table=self.target_table)
        self.logger.info("Upserted %s metric rows into '%s'", len(metrics_df), self.target_table)

    def plot(self, metrics_df: pd.DataFrame) -> None:
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
            save_time_series_plot(
                df=metrics_df,
                date_col="exam_date",
                value_col=col,
                title=title,
                out_path=self.plot_dir / f"{col}_trend.png",
            )
        self.logger.info("Saved lipidemic plots into %s", self.plot_dir)

    def run(self) -> pd.DataFrame:
        raw_df = self.extract()
        if raw_df.empty:
            self.logger.warning("No lipidemic rows found in source table '%s'", self.source_table)
            return raw_df

        metrics_df = self.transform(raw_df)
        self.load(metrics_df)
        self.plot(metrics_df)
        return metrics_df


def run_lipidemic_pipeline(config, logger) -> pd.DataFrame:
    pipeline = LipidMetricsPipeline(config=config, logger=logger)
    return pipeline.run()
