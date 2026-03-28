from __future__ import annotations

import numpy as np
import pandas as pd


def to_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").astype(float)


def safe_div(a: pd.Series, b: pd.Series) -> pd.Series:
    a = to_numeric(a)
    b = to_numeric(b)
    out = a / b
    out = out.replace([np.inf, -np.inf], np.nan)
    return out.astype(float)


def compute_homa_ir(glucose_mgdl: pd.Series, fasting_insulin: pd.Series) -> pd.Series:
    glucose_mgdl = to_numeric(glucose_mgdl)
    fasting_insulin = to_numeric(fasting_insulin)
    result = (fasting_insulin * glucose_mgdl) / 405.0
    result = result.replace([np.inf, -np.inf], np.nan)
    return result.astype(float)


def compute_quicki(glucose_mgdl: pd.Series, fasting_insulin: pd.Series) -> pd.Series:
    glucose_mgdl = to_numeric(glucose_mgdl)
    fasting_insulin = to_numeric(fasting_insulin)

    valid = (
        glucose_mgdl.notna()
        & fasting_insulin.notna()
        & (glucose_mgdl > 0)
        & (fasting_insulin > 0)
    )

    result = pd.Series(np.nan, index=glucose_mgdl.index, dtype=float)
    result.loc[valid] = 1.0 / (
        np.log10(fasting_insulin.loc[valid]) + np.log10(glucose_mgdl.loc[valid])
    )
    result = result.replace([np.inf, -np.inf], np.nan)
    return result.astype(float)


def compute_eag_mgdl(hba1c: pd.Series) -> pd.Series:
    hba1c = to_numeric(hba1c)
    result = (28.7 * hba1c) - 46.7
    result = result.replace([np.inf, -np.inf], np.nan)
    return result.astype(float)


def classify_homa_ir(homa_ir: pd.Series) -> pd.Series:
    x = to_numeric(homa_ir)
    result = pd.Series(pd.NA, index=x.index, dtype="object")

    result.loc[x < 1.0] = "Very insulin sensitive"
    result.loc[(x >= 1.0) & (x < 2.0)] = "Favorable / normal"
    result.loc[(x >= 2.0) & (x < 3.0)] = "Borderline insulin resistance"
    result.loc[x >= 3.0] = "Insulin resistance signal"

    return result


def classify_vitamin_d(vitamin_d_25_oh: pd.Series) -> pd.Series:
    x = to_numeric(vitamin_d_25_oh)
    result = pd.Series(pd.NA, index=x.index, dtype="object")

    result.loc[x < 20] = "Deficient"
    result.loc[(x >= 20) & (x < 30)] = "Insufficient"
    result.loc[(x >= 30) & (x <= 50)] = "Sufficient"
    result.loc[(x > 50) & (x <= 100)] = "High / upper range"
    result.loc[x > 100] = "Potential excess / toxicity concern"

    return result


def compute_endocrinology_metrics(raw_df: pd.DataFrame, profile_config: dict) -> pd.DataFrame:
    df = raw_df.copy()
    df = df.sort_values("exam_date").reset_index(drop=True)

    numeric_cols = [
        "glucose_for_calc",
        "fasting_insulin",
        "hba1c",
        "tsh",
        "free_t4",
        "vitamin_d_25_oh",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = to_numeric(df[col])
        else:
            df[col] = np.nan

    df["homa_ir"] = compute_homa_ir(df["glucose_for_calc"], df["fasting_insulin"])
    df["quicki"] = compute_quicki(df["glucose_for_calc"], df["fasting_insulin"])
    df["eag_mgdl"] = compute_eag_mgdl(df["hba1c"])
    df["tsh_free_t4_ratio"] = safe_div(df["tsh"], df["free_t4"])

    df["vitamin_d_status"] = classify_vitamin_d(df["vitamin_d_25_oh"])
    df["homa_ir_interpretation"] = classify_homa_ir(df["homa_ir"])

    trend_cols = [
        "glucose_for_calc",
        "fasting_insulin",
        "hba1c",
        "tsh",
        "free_t4",
        "vitamin_d_25_oh",
        "homa_ir",
        "quicki",
        "eag_mgdl",
        "tsh_free_t4_ratio",
    ]

    for col in trend_cols:
        prev = df[col].shift(1)
        df[f"{col}_prev"] = prev
        df[f"{col}_delta"] = df[col] - prev
        df[f"{col}_pct_change"] = ((df[col] - prev) / prev.replace(0, np.nan)) * 100.0
        df[f"{col}_rolling3"] = df[col].rolling(window=3, min_periods=1).mean()

    df["has_core_endocrine"] = (
        df["glucose_for_calc"].notna()
        | df["fasting_insulin"].notna()
        | df["hba1c"].notna()
        | df["tsh"].notna()
        | df["free_t4"].notna()
        | df["vitamin_d_25_oh"].notna()
    ).astype(int)

    df["is_complete_profile"] = (
        df["glucose_for_calc"].notna()
        & df["fasting_insulin"].notna()
        & df["hba1c"].notna()
        & df["tsh"].notna()
        & df["free_t4"].notna()
        & df["vitamin_d_25_oh"].notna()
    ).astype(int)

    df["record_quality_note"] = np.select(
        [
            df["is_complete_profile"].eq(1),
            df["has_core_endocrine"].eq(1),
        ],
        [
            "complete",
            "partial_raw_data",
        ],
        default="missing_profile_data",
    )

    return df
