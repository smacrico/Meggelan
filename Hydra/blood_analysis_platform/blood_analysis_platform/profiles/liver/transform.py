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


def compute_ast_alt_ratio(ast: pd.Series, alt: pd.Series) -> pd.Series:
    return safe_div(ast, alt)


def compute_indirect_bilirubin(total_bilirubin: pd.Series, direct_bilirubin: pd.Series) -> pd.Series:
    total_bilirubin = to_numeric(total_bilirubin)
    direct_bilirubin = to_numeric(direct_bilirubin)
    result = total_bilirubin - direct_bilirubin
    result = result.replace([np.inf, -np.inf], np.nan)
    return result.astype(float)


def compute_direct_total_bilirubin_pct(total_bilirubin: pd.Series, direct_bilirubin: pd.Series) -> pd.Series:
    return safe_div(direct_bilirubin, total_bilirubin) * 100.0


def classify_ast_alt_ratio(x: pd.Series) -> pd.Series:
    x = to_numeric(x)
    result = pd.Series(pd.NA, index=x.index, dtype="object")
    result.loc[(x >= 0.7) & (x <= 1.2)] = "Balanced"
    result.loc[((x >= 0.5) & (x < 0.7)) | ((x > 1.2) & (x <= 2.0))] = "Borderline pattern"
    result.loc[x > 2.0] = "AST-predominant / stronger concern"
    result.loc[x < 0.5] = "ALT-predominant"
    return result


def classify_direct_bili_pct(x: pd.Series) -> pd.Series:
    x = to_numeric(x)
    result = pd.Series(pd.NA, index=x.index, dtype="object")
    result.loc[x < 20] = "Low direct fraction"
    result.loc[(x >= 20) & (x < 30)] = "Balanced"
    result.loc[(x >= 30) & (x <= 40)] = "Borderline direct-predominant"
    result.loc[x > 40] = "Higher direct-predominant pattern"
    return result


def classify_bilirubin_pattern(indirect_bili: pd.Series, direct_pct: pd.Series) -> pd.Series:
    indirect_bili = to_numeric(indirect_bili)
    direct_pct = to_numeric(direct_pct)

    result = pd.Series(pd.NA, index=indirect_bili.index, dtype="object")
    result.loc[(direct_pct < 30)] = "Indirect-predominant / mixed"
    result.loc[(direct_pct >= 30)] = "Direct/conjugated contribution higher"
    result.loc[indirect_bili.isna() & direct_pct.isna()] = pd.NA
    return result


def compute_liver_metrics(raw_df: pd.DataFrame, profile_config: dict) -> pd.DataFrame:
    df = raw_df.copy()
    df = df.sort_values("exam_date").reset_index(drop=True)

    numeric_cols = [
        "ast",
        "alt",
        "ggt",
        "alp",
        "total_bilirubin",
        "direct_bilirubin",
        "albumin",
        "ldh",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = to_numeric(df[col])
        else:
            df[col] = np.nan

    df["ast_alt_ratio"] = compute_ast_alt_ratio(df["ast"], df["alt"])
    df["indirect_bilirubin"] = compute_indirect_bilirubin(df["total_bilirubin"], df["direct_bilirubin"])
    df["direct_total_bilirubin_pct"] = compute_direct_total_bilirubin_pct(
        df["total_bilirubin"], df["direct_bilirubin"]
    )

    df["ast_alt_pattern"] = classify_ast_alt_ratio(df["ast_alt_ratio"])
    df["direct_total_bilirubin_risk"] = classify_direct_bili_pct(df["direct_total_bilirubin_pct"])
    df["bilirubin_pattern"] = classify_bilirubin_pattern(
        df["indirect_bilirubin"], df["direct_total_bilirubin_pct"]
    )

    trend_cols = [
        "ast",
        "alt",
        "ggt",
        "alp",
        "total_bilirubin",
        "direct_bilirubin",
        "albumin",
        "ldh",
        "ast_alt_ratio",
        "indirect_bilirubin",
        "direct_total_bilirubin_pct",
    ]

    for col in trend_cols:
        prev = df[col].shift(1)
        df[f"{col}_prev"] = prev
        df[f"{col}_delta"] = df[col] - prev
        df[f"{col}_pct_change"] = ((df[col] - prev) / prev.replace(0, np.nan)) * 100.0
        df[f"{col}_rolling3"] = df[col].rolling(window=3, min_periods=1).mean()

    df["has_core_liver"] = (
        df["ast"].notna()
        | df["alt"].notna()
        | df["ggt"].notna()
        | df["alp"].notna()
        | df["total_bilirubin"].notna()
        | df["direct_bilirubin"].notna()
    ).astype(int)

    df["is_complete_profile"] = (
        df["ast"].notna()
        & df["alt"].notna()
        & df["ggt"].notna()
        & df["alp"].notna()
        & df["total_bilirubin"].notna()
        & df["direct_bilirubin"].notna()
    ).astype(int)

    df["record_quality_note"] = np.select(
        [
            df["is_complete_profile"].eq(1),
            df["has_core_liver"].eq(1),
        ],
        [
            "complete",
            "partial_raw_data",
        ],
        default="missing_profile_data",
    )

    return df