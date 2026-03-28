
"""
Blood Analysis Platform - Lipidemic Profile metric pipeline

Reads raw lipid rows from hydra.dbo.lipid_raw, computes derived lipid metrics,
stores them into hydra.dbo.lipid_metrics, and produces trend plots to C:\temp.

Assumptions
-----------
- Source values are in mg/dL.
- Source table contains one row per exam date.
- DB is SQL Server (pyodbc / SQLAlchemy example below), but the metric logic is DB agnostic.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Iterable

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sqlalchemy import create_engine, text


PLOT_DIR = Path(r"C:\temp\LogsFitnessApp\Lipid_Dashboard")
PLOT_DIR.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class DbConfig:
    connection_string: str  # e.g. mssql+pyodbc:///?odbc_connect=...


class LipidMetricsPipeline:
    REQUIRED_COLUMNS = {
        "exam_date",
        "total_cholesterol",
        "hdl",
        "ldl",
        "triglycerides",
        "reported_non_hdl",
        "lpa",
    }

    def __init__(self, engine):
        self.engine = engine

    # ----------------------------
    # Extract
    # ----------------------------
    def load_raw(self) -> pd.DataFrame:
        sql = """
        SELECT
            CAST([Exam Date] AS date) AS exam_date,
            CAST([Total Cholesterol] AS float) AS total_cholesterol,
            CAST([HDL] AS float) AS hdl,
            CAST([LDL] AS float) AS ldl,
            CAST([Triglycerides] AS float) AS triglycerides,
            CAST([Reported Non-HDL] AS float) AS reported_non_hdl,
            CAST([Lp(a)] AS float) AS lpa
        FROM hydra.dbo.lipid_raw
        ORDER BY CAST([Exam Date] AS date)
        """
        df = pd.read_sql(sql, self.engine)
        missing = self.REQUIRED_COLUMNS - set(df.columns.str.lower())
        if missing:
            raise ValueError(f"Missing required columns: {sorted(missing)}")
        return df.sort_values("exam_date").reset_index(drop=True)

    # ----------------------------
    # Transform
    # ----------------------------
    @staticmethod
    def safe_div(a: pd.Series, b: pd.Series) -> pd.Series:
        out = a / b
        out = out.replace([np.inf, -np.inf], np.nan)
        return out

    @staticmethod
    def friedewald_ldl(tc: pd.Series, hdl: pd.Series, tg: pd.Series) -> pd.Series:
        """
        Friedewald LDL in mg/dL, valid when TG < 400 mg/dL.
        """
        calc = tc - hdl - (tg / 5.0)
        calc = calc.where(tg < 400, np.nan)
        return calc

    @staticmethod
    def sampson_ldl(tc: pd.Series, hdl: pd.Series, tg: pd.Series) -> pd.Series:
        """
        Sampson NIH equation for LDL-C in mg/dL.
        Valid up to TG 800 mg/dL in the original publication context.
        """
        return (
            tc / 0.948
            - hdl / 0.971
            - (tg / 8.56 + (tg * (tc - hdl)) / 2140.0 - (tg ** 2) / 16100.0)
            - 9.44
        )

    @staticmethod
    def mgdl_to_mmol_l_chol(x: pd.Series) -> pd.Series:
        return x / 38.67

    @staticmethod
    def mgdl_to_mmol_l_tg(x: pd.Series) -> pd.Series:
        return x / 88.57

    def classify_tg(self, tg: pd.Series) -> pd.Series:
        return pd.cut(
            tg,
            bins=[-np.inf, 150, 200, 500, np.inf],
            labels=["Normal", "Borderline High", "High", "Very High"],
            right=False,
        ).astype("object")

    def classify_non_hdl(self, x: pd.Series) -> pd.Series:
        return pd.cut(
            x,
            bins=[-np.inf, 130, 160, 190, np.inf],
            labels=["Optimal/near-optimal", "Borderline high", "High", "Very high"],
            right=False,
        ).astype("object")

    def classify_tc_hdl(self, x: pd.Series) -> pd.Series:
        return pd.cut(
            x,
            bins=[-np.inf, 4.0, 5.0, np.inf],
            labels=["Favorable", "Borderline", "Higher risk"],
            right=False,
        ).astype("object")

    def classify_ldl_hdl(self, x: pd.Series) -> pd.Series:
        return pd.cut(
            x,
            bins=[-np.inf, 2.0, 3.0, np.inf],
            labels=["Favorable", "Borderline", "Less favorable"],
            right=False,
        ).astype("object")

    def classify_tg_hdl(self, x: pd.Series) -> pd.Series:
        bins = [-np.inf, 2.0, 3.0, 4.0, np.inf]
        labels = ["Favorable", "Borderline", "Higher risk", "Marked metabolic-risk signal"]
        return pd.cut(x, bins=bins, labels=labels, right=False).astype("object")

    def classify_aip(self, x: pd.Series) -> pd.Series:
        return pd.cut(
            x,
            bins=[-np.inf, 0.11, 0.21, np.inf],
            labels=["Low risk", "Intermediate risk", "High risk"],
            right=False,
        ).astype("object")

    def classify_remnant(self, x: pd.Series) -> pd.Series:
        return pd.cut(
            x,
            bins=[-np.inf, 20, 30, np.inf],
            labels=["Favorable", "Borderline", "Higher residual risk"],
            right=False,
        ).astype("object")

    def compute_metrics(self, raw_df: pd.DataFrame) -> pd.DataFrame:
        df = raw_df.copy()

        # Normalize column names defensively
        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        # Prefer reported LDL when present, otherwise calculate it.
        df["ldl_friedewald"] = self.friedewald_ldl(
            df["total_cholesterol"], df["hdl"], df["triglycerides"]
        )
        df["ldl_sampson"] = self.sampson_ldl(
            df["total_cholesterol"], df["hdl"], df["triglycerides"]
        ).where(df["triglycerides"] <= 800, np.nan)

        df["ldl_final"] = df["ldl"].combine_first(df["ldl_friedewald"])
        df["ldl_method"] = np.where(
            df["ldl"].notna(),
            "reported",
            np.where(df["ldl_friedewald"].notna(), "friedewald", "unavailable"),
        )

        df["non_hdl_calc"] = df["total_cholesterol"] - df["hdl"]
        df["non_hdl_final"] = df["reported_non_hdl"].combine_first(df["non_hdl_calc"])
        df["non_hdl_delta_vs_reported"] = df["non_hdl_calc"] - df["reported_non_hdl"]

        df["tc_hdl_ratio"] = self.safe_div(df["total_cholesterol"], df["hdl"])
        df["ldl_hdl_ratio"] = self.safe_div(df["ldl_final"], df["hdl"])
        df["tg_hdl_ratio"] = self.safe_div(df["triglycerides"], df["hdl"])
        df["remnant_cholesterol"] = df["total_cholesterol"] - df["hdl"] - df["ldl_final"]

        tg_mmol = self.mgdl_to_mmol_l_tg(df["triglycerides"])
        hdl_mmol = self.mgdl_to_mmol_l_chol(df["hdl"])
        df["aip"] = np.log10(self.safe_div(tg_mmol, hdl_mmol))

        # Optional extra metrics useful in practice
        df["vldl_estimated"] = df["triglycerides"] / 5.0
        df["cholesterol_residual_burden"] = df["non_hdl_final"] - df["ldl_final"]
        df["lpa_present"] = df["lpa"].notna().astype(int)

        # Categorical interpretation
        df["tg_status"] = self.classify_tg(df["triglycerides"])
        df["non_hdl_risk"] = self.classify_non_hdl(df["non_hdl_final"])
        df["tc_hdl_risk"] = self.classify_tc_hdl(df["tc_hdl_ratio"])
        df["ldl_hdl_risk"] = self.classify_ldl_hdl(df["ldl_hdl_ratio"])
        df["tg_hdl_risk"] = self.classify_tg_hdl(df["tg_hdl_ratio"])
        df["aip_risk"] = self.classify_aip(df["aip"])
        df["remnant_risk"] = self.classify_remnant(df["remnant_cholesterol"])

        # Trend features against previous available record
        trend_cols = [
            "total_cholesterol", "hdl", "ldl_final", "triglycerides",
            "non_hdl_final", "tc_hdl_ratio", "ldl_hdl_ratio", "tg_hdl_ratio",
            "aip", "remnant_cholesterol", "lpa"
        ]
        for col in trend_cols:
            prev = df[col].shift(1)
            df[f"{col}_prev"] = prev
            df[f"{col}_delta"] = df[col] - prev
            df[f"{col}_pct_change"] = ((df[col] - prev) / prev.replace(0, np.nan)) * 100.0
            df[f"{col}_rolling3"] = df[col].rolling(window=3, min_periods=1).mean()

        # Overall profile quality flags
        df["has_core_lipids"] = (
            df["total_cholesterol"].notna()
            & df["hdl"].notna()
            & df["triglycerides"].notna()
        ).astype(int)

        df["is_complete_profile"] = (
            df["total_cholesterol"].notna()
            & df["hdl"].notna()
            & (df["ldl"].notna() | df["ldl_friedewald"].notna())
            & df["triglycerides"].notna()
        ).astype(int)

        df["record_quality_note"] = np.select(
            [
                df["is_complete_profile"].eq(1),
                df["has_core_lipids"].eq(1),
            ],
            [
                "complete",
                "derived_with_missing_ldl",
            ],
            default="partial_raw_data",
        )

        return df

    # ----------------------------
    # Load
    # ----------------------------
    def ensure_target_table(self) -> None:
        ddl = """
        IF OBJECT_ID('hydra.dbo.lipid_metrics', 'U') IS NULL
        BEGIN
            CREATE TABLE hydra.dbo.lipid_metrics (
                metric_id bigint IDENTITY(1,1) PRIMARY KEY,
                exam_date date NOT NULL UNIQUE,

                total_cholesterol float NULL,
                hdl float NULL,
                ldl_reported float NULL,
                triglycerides float NULL,
                reported_non_hdl float NULL,
                lpa float NULL,

                ldl_friedewald float NULL,
                ldl_sampson float NULL,
                ldl_final float NULL,
                ldl_method varchar(20) NULL,

                non_hdl_calc float NULL,
                non_hdl_final float NULL,
                non_hdl_delta_vs_reported float NULL,

                tc_hdl_ratio float NULL,
                ldl_hdl_ratio float NULL,
                tg_hdl_ratio float NULL,
                aip float NULL,
                remnant_cholesterol float NULL,
                vldl_estimated float NULL,
                cholesterol_residual_burden float NULL,
                lpa_present bit NOT NULL DEFAULT 0,

                tg_status varchar(30) NULL,
                non_hdl_risk varchar(30) NULL,
                tc_hdl_risk varchar(30) NULL,
                ldl_hdl_risk varchar(30) NULL,
                tg_hdl_risk varchar(40) NULL,
                aip_risk varchar(30) NULL,
                remnant_risk varchar(30) NULL,

                total_cholesterol_prev float NULL,
                total_cholesterol_delta float NULL,
                total_cholesterol_pct_change float NULL,
                total_cholesterol_rolling3 float NULL,

                hdl_prev float NULL,
                hdl_delta float NULL,
                hdl_pct_change float NULL,
                hdl_rolling3 float NULL,

                ldl_final_prev float NULL,
                ldl_final_delta float NULL,
                ldl_final_pct_change float NULL,
                ldl_final_rolling3 float NULL,

                triglycerides_prev float NULL,
                triglycerides_delta float NULL,
                triglycerides_pct_change float NULL,
                triglycerides_rolling3 float NULL,

                non_hdl_final_prev float NULL,
                non_hdl_final_delta float NULL,
                non_hdl_final_pct_change float NULL,
                non_hdl_final_rolling3 float NULL,

                tc_hdl_ratio_prev float NULL,
                tc_hdl_ratio_delta float NULL,
                tc_hdl_ratio_pct_change float NULL,
                tc_hdl_ratio_rolling3 float NULL,

                ldl_hdl_ratio_prev float NULL,
                ldl_hdl_ratio_delta float NULL,
                ldl_hdl_ratio_pct_change float NULL,
                ldl_hdl_ratio_rolling3 float NULL,

                tg_hdl_ratio_prev float NULL,
                tg_hdl_ratio_delta float NULL,
                tg_hdl_ratio_pct_change float NULL,
                tg_hdl_ratio_rolling3 float NULL,

                aip_prev float NULL,
                aip_delta float NULL,
                aip_pct_change float NULL,
                aip_rolling3 float NULL,

                remnant_cholesterol_prev float NULL,
                remnant_cholesterol_delta float NULL,
                remnant_cholesterol_pct_change float NULL,
                remnant_cholesterol_rolling3 float NULL,

                lpa_prev float NULL,
                lpa_delta float NULL,
                lpa_pct_change float NULL,
                lpa_rolling3 float NULL,

                has_core_lipids bit NOT NULL DEFAULT 0,
                is_complete_profile bit NOT NULL DEFAULT 0,
                record_quality_note varchar(50) NULL,

                created_at datetime2 NOT NULL DEFAULT sysdatetime(),
                updated_at datetime2 NOT NULL DEFAULT sysdatetime()
            );
        END
        """
        with self.engine.begin() as conn:
            conn.execute(text(ddl))

    def upsert_metrics(self, metrics_df: pd.DataFrame) -> None:
        rows = metrics_df.rename(
            columns={
                "ldl": "ldl_reported",
            }
        ).to_dict(orient="records")

        merge_sql = """
        MERGE hydra.dbo.lipid_metrics AS target
        USING (
            SELECT
                :exam_date AS exam_date,
                :total_cholesterol AS total_cholesterol,
                :hdl AS hdl,
                :ldl_reported AS ldl_reported,
                :triglycerides AS triglycerides,
                :reported_non_hdl AS reported_non_hdl,
                :lpa AS lpa,
                :ldl_friedewald AS ldl_friedewald,
                :ldl_sampson AS ldl_sampson,
                :ldl_final AS ldl_final,
                :ldl_method AS ldl_method,
                :non_hdl_calc AS non_hdl_calc,
                :non_hdl_final AS non_hdl_final,
                :non_hdl_delta_vs_reported AS non_hdl_delta_vs_reported,
                :tc_hdl_ratio AS tc_hdl_ratio,
                :ldl_hdl_ratio AS ldl_hdl_ratio,
                :tg_hdl_ratio AS tg_hdl_ratio,
                :aip AS aip,
                :remnant_cholesterol AS remnant_cholesterol,
                :vldl_estimated AS vldl_estimated,
                :cholesterol_residual_burden AS cholesterol_residual_burden,
                :lpa_present AS lpa_present,
                :tg_status AS tg_status,
                :non_hdl_risk AS non_hdl_risk,
                :tc_hdl_risk AS tc_hdl_risk,
                :ldl_hdl_risk AS ldl_hdl_risk,
                :tg_hdl_risk AS tg_hdl_risk,
                :aip_risk AS aip_risk,
                :remnant_risk AS remnant_risk,
                :total_cholesterol_prev AS total_cholesterol_prev,
                :total_cholesterol_delta AS total_cholesterol_delta,
                :total_cholesterol_pct_change AS total_cholesterol_pct_change,
                :total_cholesterol_rolling3 AS total_cholesterol_rolling3,
                :hdl_prev AS hdl_prev,
                :hdl_delta AS hdl_delta,
                :hdl_pct_change AS hdl_pct_change,
                :hdl_rolling3 AS hdl_rolling3,
                :ldl_final_prev AS ldl_final_prev,
                :ldl_final_delta AS ldl_final_delta,
                :ldl_final_pct_change AS ldl_final_pct_change,
                :ldl_final_rolling3 AS ldl_final_rolling3,
                :triglycerides_prev AS triglycerides_prev,
                :triglycerides_delta AS triglycerides_delta,
                :triglycerides_pct_change AS triglycerides_pct_change,
                :triglycerides_rolling3 AS triglycerides_rolling3,
                :non_hdl_final_prev AS non_hdl_final_prev,
                :non_hdl_final_delta AS non_hdl_final_delta,
                :non_hdl_final_pct_change AS non_hdl_final_pct_change,
                :non_hdl_final_rolling3 AS non_hdl_final_rolling3,
                :tc_hdl_ratio_prev AS tc_hdl_ratio_prev,
                :tc_hdl_ratio_delta AS tc_hdl_ratio_delta,
                :tc_hdl_ratio_pct_change AS tc_hdl_ratio_pct_change,
                :tc_hdl_ratio_rolling3 AS tc_hdl_ratio_rolling3,
                :ldl_hdl_ratio_prev AS ldl_hdl_ratio_prev,
                :ldl_hdl_ratio_delta AS ldl_hdl_ratio_delta,
                :ldl_hdl_ratio_pct_change AS ldl_hdl_ratio_pct_change,
                :ldl_hdl_ratio_rolling3 AS ldl_hdl_ratio_rolling3,
                :tg_hdl_ratio_prev AS tg_hdl_ratio_prev,
                :tg_hdl_ratio_delta AS tg_hdl_ratio_delta,
                :tg_hdl_ratio_pct_change AS tg_hdl_ratio_pct_change,
                :tg_hdl_ratio_rolling3 AS tg_hdl_ratio_rolling3,
                :aip_prev AS aip_prev,
                :aip_delta AS aip_delta,
                :aip_pct_change AS aip_pct_change,
                :aip_rolling3 AS aip_rolling3,
                :remnant_cholesterol_prev AS remnant_cholesterol_prev,
                :remnant_cholesterol_delta AS remnant_cholesterol_delta,
                :remnant_cholesterol_pct_change AS remnant_cholesterol_pct_change,
                :remnant_cholesterol_rolling3 AS remnant_cholesterol_rolling3,
                :lpa_prev AS lpa_prev,
                :lpa_delta AS lpa_delta,
                :lpa_pct_change AS lpa_pct_change,
                :lpa_rolling3 AS lpa_rolling3,
                :has_core_lipids AS has_core_lipids,
                :is_complete_profile AS is_complete_profile,
                :record_quality_note AS record_quality_note
        ) AS src
        ON target.exam_date = src.exam_date
        WHEN MATCHED THEN
            UPDATE SET
                total_cholesterol = src.total_cholesterol,
                hdl = src.hdl,
                ldl_reported = src.ldl_reported,
                triglycerides = src.triglycerides,
                reported_non_hdl = src.reported_non_hdl,
                lpa = src.lpa,
                ldl_friedewald = src.ldl_friedewald,
                ldl_sampson = src.ldl_sampson,
                ldl_final = src.ldl_final,
                ldl_method = src.ldl_method,
                non_hdl_calc = src.non_hdl_calc,
                non_hdl_final = src.non_hdl_final,
                non_hdl_delta_vs_reported = src.non_hdl_delta_vs_reported,
                tc_hdl_ratio = src.tc_hdl_ratio,
                ldl_hdl_ratio = src.ldl_hdl_ratio,
                tg_hdl_ratio = src.tg_hdl_ratio,
                aip = src.aip,
                remnant_cholesterol = src.remnant_cholesterol,
                vldl_estimated = src.vldl_estimated,
                cholesterol_residual_burden = src.cholesterol_residual_burden,
                lpa_present = src.lpa_present,
                tg_status = src.tg_status,
                non_hdl_risk = src.non_hdl_risk,
                tc_hdl_risk = src.tc_hdl_risk,
                ldl_hdl_risk = src.ldl_hdl_risk,
                tg_hdl_risk = src.tg_hdl_risk,
                aip_risk = src.aip_risk,
                remnant_risk = src.remnant_risk,
                total_cholesterol_prev = src.total_cholesterol_prev,
                total_cholesterol_delta = src.total_cholesterol_delta,
                total_cholesterol_pct_change = src.total_cholesterol_pct_change,
                total_cholesterol_rolling3 = src.total_cholesterol_rolling3,
                hdl_prev = src.hdl_prev,
                hdl_delta = src.hdl_delta,
                hdl_pct_change = src.hdl_pct_change,
                hdl_rolling3 = src.hdl_rolling3,
                ldl_final_prev = src.ldl_final_prev,
                ldl_final_delta = src.ldl_final_delta,
                ldl_final_pct_change = src.ldl_final_pct_change,
                ldl_final_rolling3 = src.ldl_final_rolling3,
                triglycerides_prev = src.triglycerides_prev,
                triglycerides_delta = src.triglycerides_delta,
                triglycerides_pct_change = src.triglycerides_pct_change,
                triglycerides_rolling3 = src.triglycerides_rolling3,
                non_hdl_final_prev = src.non_hdl_final_prev,
                non_hdl_final_delta = src.non_hdl_final_delta,
                non_hdl_final_pct_change = src.non_hdl_final_pct_change,
                non_hdl_final_rolling3 = src.non_hdl_final_rolling3,
                tc_hdl_ratio_prev = src.tc_hdl_ratio_prev,
                tc_hdl_ratio_delta = src.tc_hdl_ratio_delta,
                tc_hdl_ratio_pct_change = src.tc_hdl_ratio_pct_change,
                tc_hdl_ratio_rolling3 = src.tc_hdl_ratio_rolling3,
                ldl_hdl_ratio_prev = src.ldl_hdl_ratio_prev,
                ldl_hdl_ratio_delta = src.ldl_hdl_ratio_delta,
                ldl_hdl_ratio_pct_change = src.ldl_hdl_ratio_pct_change,
                ldl_hdl_ratio_rolling3 = src.ldl_hdl_ratio_rolling3,
                tg_hdl_ratio_prev = src.tg_hdl_ratio_prev,
                tg_hdl_ratio_delta = src.tg_hdl_ratio_delta,
                tg_hdl_ratio_pct_change = src.tg_hdl_ratio_pct_change,
                tg_hdl_ratio_rolling3 = src.tg_hdl_ratio_rolling3,
                aip_prev = src.aip_prev,
                aip_delta = src.aip_delta,
                aip_pct_change = src.aip_pct_change,
                aip_rolling3 = src.aip_rolling3,
                remnant_cholesterol_prev = src.remnant_cholesterol_prev,
                remnant_cholesterol_delta = src.remnant_cholesterol_delta,
                remnant_cholesterol_pct_change = src.remnant_cholesterol_pct_change,
                remnant_cholesterol_rolling3 = src.remnant_cholesterol_rolling3,
                lpa_prev = src.lpa_prev,
                lpa_delta = src.lpa_delta,
                lpa_pct_change = src.lpa_pct_change,
                lpa_rolling3 = src.lpa_rolling3,
                has_core_lipids = src.has_core_lipids,
                is_complete_profile = src.is_complete_profile,
                record_quality_note = src.record_quality_note,
                updated_at = sysdatetime()
        WHEN NOT MATCHED THEN
            INSERT (
                exam_date, total_cholesterol, hdl, ldl_reported, triglycerides, reported_non_hdl, lpa,
                ldl_friedewald, ldl_sampson, ldl_final, ldl_method,
                non_hdl_calc, non_hdl_final, non_hdl_delta_vs_reported,
                tc_hdl_ratio, ldl_hdl_ratio, tg_hdl_ratio, aip, remnant_cholesterol,
                vldl_estimated, cholesterol_residual_burden, lpa_present,
                tg_status, non_hdl_risk, tc_hdl_risk, ldl_hdl_risk, tg_hdl_risk, aip_risk, remnant_risk,
                total_cholesterol_prev, total_cholesterol_delta, total_cholesterol_pct_change, total_cholesterol_rolling3,
                hdl_prev, hdl_delta, hdl_pct_change, hdl_rolling3,
                ldl_final_prev, ldl_final_delta, ldl_final_pct_change, ldl_final_rolling3,
                triglycerides_prev, triglycerides_delta, triglycerides_pct_change, triglycerides_rolling3,
                non_hdl_final_prev, non_hdl_final_delta, non_hdl_final_pct_change, non_hdl_final_rolling3,
                tc_hdl_ratio_prev, tc_hdl_ratio_delta, tc_hdl_ratio_pct_change, tc_hdl_ratio_rolling3,
                ldl_hdl_ratio_prev, ldl_hdl_ratio_delta, ldl_hdl_ratio_pct_change, ldl_hdl_ratio_rolling3,
                tg_hdl_ratio_prev, tg_hdl_ratio_delta, tg_hdl_ratio_pct_change, tg_hdl_ratio_rolling3,
                aip_prev, aip_delta, aip_pct_change, aip_rolling3,
                remnant_cholesterol_prev, remnant_cholesterol_delta, remnant_cholesterol_pct_change, remnant_cholesterol_rolling3,
                lpa_prev, lpa_delta, lpa_pct_change, lpa_rolling3,
                has_core_lipids, is_complete_profile, record_quality_note
            )
            VALUES (
                src.exam_date, src.total_cholesterol, src.hdl, src.ldl_reported, src.triglycerides, src.reported_non_hdl, src.lpa,
                src.ldl_friedewald, src.ldl_sampson, src.ldl_final, src.ldl_method,
                src.non_hdl_calc, src.non_hdl_final, src.non_hdl_delta_vs_reported,
                src.tc_hdl_ratio, src.ldl_hdl_ratio, src.tg_hdl_ratio, src.aip, src.remnant_cholesterol,
                src.vldl_estimated, src.cholesterol_residual_burden, src.lpa_present,
                src.tg_status, src.non_hdl_risk, src.tc_hdl_risk, src.ldl_hdl_risk, src.tg_hdl_risk, src.aip_risk, src.remnant_risk,
                src.total_cholesterol_prev, src.total_cholesterol_delta, src.total_cholesterol_pct_change, src.total_cholesterol_rolling3,
                src.hdl_prev, src.hdl_delta, src.hdl_pct_change, src.hdl_rolling3,
                src.ldl_final_prev, src.ldl_final_delta, src.ldl_final_pct_change, src.ldl_final_rolling3,
                src.triglycerides_prev, src.triglycerides_delta, src.triglycerides_pct_change, src.triglycerides_rolling3,
                src.non_hdl_final_prev, src.non_hdl_final_delta, src.non_hdl_final_pct_change, src.non_hdl_final_rolling3,
                src.tc_hdl_ratio_prev, src.tc_hdl_ratio_delta, src.tc_hdl_ratio_pct_change, src.tc_hdl_ratio_rolling3,
                src.ldl_hdl_ratio_prev, src.ldl_hdl_ratio_delta, src.ldl_hdl_ratio_pct_change, src.ldl_hdl_ratio_rolling3,
                src.tg_hdl_ratio_prev, src.tg_hdl_ratio_delta, src.tg_hdl_ratio_pct_change, src.tg_hdl_ratio_rolling3,
                src.aip_prev, src.aip_delta, src.aip_pct_change, src.aip_rolling3,
                src.remnant_cholesterol_prev, src.remnant_cholesterol_delta, src.remnant_cholesterol_pct_change, src.remnant_cholesterol_rolling3,
                src.lpa_prev, src.lpa_delta, src.lpa_pct_change, src.lpa_rolling3,
                src.has_core_lipids, src.is_complete_profile, src.record_quality_note
            );
        """
        with self.engine.begin() as conn:
            for row in rows:
                conn.execute(text(merge_sql), row)

    # ----------------------------
    # Plots
    # ----------------------------
    def produce_plots(self, metrics_df: pd.DataFrame, out_dir: Path = PLOT_DIR) -> list[Path]:
        out_dir.mkdir(parents=True, exist_ok=True)

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

        created = []
        for col, title in plot_specs:
            subset = metrics_df[["exam_date", col]].dropna()
            if subset.empty:
                continue

            fig, ax = plt.subplots(figsize=(10, 5))
            ax.plot(subset["exam_date"], subset[col], marker="o")
            ax.set_title(title)
            ax.set_xlabel("Exam Date")
            ax.set_ylabel(title)
            ax.grid(True, alpha=0.3)
            fig.autofmt_xdate()

            path = out_dir / f"{col}_trend.png"
            fig.tight_layout()
            fig.savefig(path, dpi=150)
            plt.close(fig)
            created.append(path)

        return created

    def run(self) -> pd.DataFrame:
        raw_df = self.load_raw()
        metrics_df = self.compute_metrics(raw_df)
        self.ensure_target_table()
        self.upsert_metrics(metrics_df)
        self.produce_plots(metrics_df)
        return metrics_df


def build_engine(config: DbConfig):
    return create_engine(config.connection_string, future=True)


def main():
    # Replace with your SQL Server connection string.
    config = DbConfig(
        connection_string=(
            "mssql+pyodbc:///?odbc_connect="
            "Driver={ODBC Driver 17 for SQL Server};"
            "Server=YOUR_SERVER;"
            "Database=hydra;"
            "Trusted_Connection=yes;"
            "TrustServerCertificate=yes;"
        )
    )
    engine = build_engine(config)
    pipeline = LipidMetricsPipeline(engine)
    metrics_df = pipeline.run()
    print(metrics_df.tail(5).to_string(index=False))


if __name__ == "__main__":
    main()
