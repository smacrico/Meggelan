
from __future__ import annotations

import numpy as np
import pandas as pd


def safe_div(a: pd.Series, b: pd.Series) -> pd.Series:
    out = a / b
    return out.replace([np.inf, -np.inf], np.nan)


def friedewald_ldl(tc: pd.Series, hdl: pd.Series, tg: pd.Series) -> pd.Series:
    calc = tc - hdl - (tg / 5.0)
    return calc.where(tg < 400, np.nan)


def sampson_ldl(tc: pd.Series, hdl: pd.Series, tg: pd.Series) -> pd.Series:
    return (
        tc / 0.948
        - hdl / 0.971
        - (tg / 8.56 + (tg * (tc - hdl)) / 2140.0 - (tg ** 2) / 16100.0)
        - 9.44
    )


def mgdl_to_mmol_l_chol(x: pd.Series) -> pd.Series:
    return x / 38.67


def mgdl_to_mmol_l_tg(x: pd.Series) -> pd.Series:
    return x / 88.57


def classify_tg(tg: pd.Series) -> pd.Series:
    return pd.cut(
        tg,
        bins=[-np.inf, 150, 200, 500, np.inf],
        labels=["Normal", "Borderline High", "High", "Very High"],
        right=False,
    ).astype("object")


def classify_non_hdl(x: pd.Series) -> pd.Series:
    return pd.cut(
        x,
        bins=[-np.inf, 130, 160, 190, np.inf],
        labels=["Optimal/near-optimal", "Borderline high", "High", "Very high"],
        right=False,
    ).astype("object")


def classify_tc_hdl(x: pd.Series) -> pd.Series:
    return pd.cut(
        x,
        bins=[-np.inf, 4.0, 5.0, np.inf],
        labels=["Favorable", "Borderline", "Higher risk"],
        right=False,
    ).astype("object")


def classify_ldl_hdl(x: pd.Series) -> pd.Series:
    return pd.cut(
        x,
        bins=[-np.inf, 2.0, 3.0, np.inf],
        labels=["Favorable", "Borderline", "Less favorable"],
        right=False,
    ).astype("object")


def classify_tg_hdl(x: pd.Series) -> pd.Series:
    return pd.cut(
        x,
        bins=[-np.inf, 2.0, 3.0, 4.0, np.inf],
        labels=["Favorable", "Borderline", "Higher risk", "Marked metabolic-risk signal"],
        right=False,
    ).astype("object")


def classify_aip(x: pd.Series) -> pd.Series:
    return pd.cut(
        x,
        bins=[-np.inf, 0.11, 0.21, np.inf],
        labels=["Low risk", "Intermediate risk", "High risk"],
        right=False,
    ).astype("object")


def classify_remnant(x: pd.Series) -> pd.Series:
    return pd.cut(
        x,
        bins=[-np.inf, 20, 30, np.inf],
        labels=["Favorable", "Borderline", "Higher residual risk"],
        right=False,
    ).astype("object")


def compute_lipid_metrics(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()

    df["ldl_friedewald"] = friedewald_ldl(df["total_cholesterol"], df["hdl"], df["triglycerides"])
    df["ldl_sampson"] = sampson_ldl(df["total_cholesterol"], df["hdl"], df["triglycerides"]).where(
        df["triglycerides"] <= 800, np.nan
    )

    df["ldl_final"] = df["ldl"].combine_first(df["ldl_friedewald"])
    df["ldl_method"] = np.where(
        df["ldl"].notna(),
        "reported",
        np.where(df["ldl_friedewald"].notna(), "friedewald", "unavailable"),
    )

    df["non_hdl_calc"] = df["total_cholesterol"] - df["hdl"]
    df["non_hdl_final"] = df["reported_non_hdl"].combine_first(df["non_hdl_calc"])
    df["non_hdl_delta_vs_reported"] = df["non_hdl_calc"] - df["reported_non_hdl"]

    df["tc_hdl_ratio"] = safe_div(df["total_cholesterol"], df["hdl"])
    df["ldl_hdl_ratio"] = safe_div(df["ldl_final"], df["hdl"])
    df["tg_hdl_ratio"] = safe_div(df["triglycerides"], df["hdl"])
    df["remnant_cholesterol"] = df["total_cholesterol"] - df["hdl"] - df["ldl_final"]

    tg_mmol = mgdl_to_mmol_l_tg(df["triglycerides"])
    hdl_mmol = mgdl_to_mmol_l_chol(df["hdl"])
    df["aip"] = np.log10(safe_div(tg_mmol, hdl_mmol))

    df["vldl_estimated"] = df["triglycerides"] / 5.0
    df["cholesterol_residual_burden"] = df["non_hdl_final"] - df["ldl_final"]
    df["lpa_present"] = df["lpa"].notna().astype(int)

    df["tg_status"] = classify_tg(df["triglycerides"])
    df["non_hdl_risk"] = classify_non_hdl(df["non_hdl_final"])
    df["tc_hdl_risk"] = classify_tc_hdl(df["tc_hdl_ratio"])
    df["ldl_hdl_risk"] = classify_ldl_hdl(df["ldl_hdl_ratio"])
    df["tg_hdl_risk"] = classify_tg_hdl(df["tg_hdl_ratio"])
    df["aip_risk"] = classify_aip(df["aip"])
    df["remnant_risk"] = classify_remnant(df["remnant_cholesterol"])

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
