from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

from repository import RunningRepository


class RunningMetricsService:
    def __init__(
        self,
        repository: RunningRepository,
        rest_hr: int = 60,
        max_hr: int = 190,
    ) -> None:
        self.repository = repository
        self.rest_hr = rest_hr
        self.max_hr = max_hr

    @staticmethod
    def normalize_metric(series: pd.Series, higher_is_better: bool) -> pd.Series:
        series = pd.to_numeric(series, errors="coerce")
        min_val = series.min()
        max_val = series.max()
        range_val = max_val - min_val

        if pd.isna(range_val) or range_val == 0:
            return pd.Series(0.5, index=series.index, dtype=float)

        normalized = (series - min_val) / range_val
        return normalized if higher_is_better else 1 - normalized

    @staticmethod
    def safe_numeric_corr(series_a: pd.Series, series_b: pd.Series) -> float:
        valid = pd.concat([series_a, series_b], axis=1).dropna()
        if len(valid) < 2:
            return 0.0
        corr = valid.iloc[:, 0].corr(valid.iloc[:, 1])
        return 0.0 if pd.isna(corr) else float(corr)

    def load_training_log(self) -> tuple[pd.DataFrame, pd.DataFrame]:
        df = self.repository.load_running_sessions()
        if df.empty:
            return pd.DataFrame(), pd.DataFrame()

        # Assumption: time is minutes
        df["duration_min"] = pd.to_numeric(df["time"], errors="coerce").fillna(0)
        df["duration_hr"] = df["duration_min"] / 60.0

        df["efficiency_score"] = np.where(df["vo2max"] > 0, df["running_economy"] / df["vo2max"], 0)
        df["energy_cost"] = np.where(df["time"] > 0, df["running_economy"] * (df["distance"] / df["time"]), 0)
        df["speed_reserve"] = df["max_speed"] - df["avg_speed"]
        df["speed_consistency"] = np.where(df["max_speed"] > 0, df["avg_speed"] / df["max_speed"], 0)
        df["pace_per_km"] = np.where(df["avg_speed"] > 0, 60.0 / df["avg_speed"], 0)
        df["speed_efficiency"] = np.where(df["heart_rate"] > 0, df["avg_speed"] / df["heart_rate"], 0)
        df["economy_at_speed"] = np.where(df["avg_speed"] > 0, df["running_economy"] / df["avg_speed"], 0)
        df["speed_vo2max_index"] = df["avg_speed"] * df["vo2max"]

        hr_ratio = (df["heart_rate"] - self.rest_hr) / (self.max_hr - self.rest_hr)
        df["hr_ratio"] = hr_ratio.clip(lower=0, upper=1)
        df["TRIMP"] = df["duration_min"] * df["hr_ratio"]

        df["physio_efficiency"] = np.where(
            (df["hr_rs_deviation"] > 0) & (df["heart_rate"] > 0),
            (df["avg_speed"] / df["heart_rate"]) * (1 / df["hr_rs_deviation"]),
            0,
        )
        df["fatigue_index"] = np.where(
            df["avg_speed"] > 0,
            (df["hr_rs_deviation"] * df["cardiac_drift"]) / df["avg_speed"],
            0,
        )

        df["speed_zone"] = pd.cut(
            df["avg_speed"],
            bins=[0, 10, 14, np.inf],
            labels=["Slow", "Moderate", "Fast"],
            include_lowest=True,
        )

        iso = df["date"].dt.isocalendar()
        df["iso_year"] = iso.year.astype(int)
        df["iso_week"] = iso.week.astype(int)
        df["week_label"] = df["iso_year"].astype(str) + "-W" + df["iso_week"].astype(str).str.zfill(2)

        weekly_trimp = (
            df.groupby(["iso_year", "iso_week", "week_label"], as_index=False)["TRIMP"]
            .sum()
            .rename(columns={"TRIMP": "weekly_trimp"})
            .sort_values(["iso_year", "iso_week"])
            .reset_index(drop=True)
        )
        weekly_trimp["acute_load"] = weekly_trimp["weekly_trimp"]
        weekly_trimp["chronic_load"] = weekly_trimp["weekly_trimp"].rolling(window=4, min_periods=1).mean()
        weekly_trimp["acwr"] = np.where(
            weekly_trimp["chronic_load"] > 0,
            weekly_trimp["acute_load"] / weekly_trimp["chronic_load"],
            0,
        )

        df["trimp_rolling_7"] = df["TRIMP"].rolling(window=7, min_periods=1).mean()
        df["speed_rolling_7"] = df["avg_speed"].rolling(window=7, min_periods=1).mean()
        df["hr_rs_rolling_7"] = df["hr_rs_deviation"].rolling(window=7, min_periods=1).mean()

        return df, weekly_trimp
        
    def analyze_speed_metrics(self, df: pd.DataFrame) -> dict | None:
        if df.empty:
            return None

        data = df.sort_values("date")

        result = {
            "avg_speed_mean": float(data["avg_speed"].mean()),
            "avg_speed_std": float(data["avg_speed"].std()) if not pd.isna(data["avg_speed"].std()) else 0.0,
            "max_speed_mean": float(data["max_speed"].mean()),
            "max_speed_peak": float(data["max_speed"].max()),
            "speed_reserve_mean": float(data["speed_reserve"].mean()),
            "speed_consistency_mean": float(data["speed_consistency"].mean()),
            "pace_per_km_mean": float(data["pace_per_km"].mean()),
            "speed_efficiency_mean": float(data["speed_efficiency"].mean()),
            "economy_at_speed_mean": float(data["economy_at_speed"].mean()),
            "speed_zone_counts": data["speed_zone"].value_counts().to_dict(),
        }

        if len(data) >= 10:
            early_avg = data.head(5)["avg_speed"].mean()
            recent_avg = data.tail(5)["avg_speed"].mean()
            improvement_pct = ((recent_avg - early_avg) / early_avg * 100) if early_avg else 0.0
            result["speed_improvement_pct"] = float(improvement_pct)

        return result

    def analyze_hr_rs_deviation(self, df: pd.DataFrame) -> dict | None:
        if df.empty:
            return None

        valid = df[df["hr_rs_deviation"] > 0].copy()
        if valid.empty:
            return None

        mean_val = valid["hr_rs_deviation"].mean()
        std_val = valid["hr_rs_deviation"].std()
        cv = ((std_val / mean_val) * 100) if mean_val else 0.0

        result = {
            "mean": float(mean_val),
            "std": float(std_val) if not pd.isna(std_val) else 0.0,
            "min": float(valid["hr_rs_deviation"].min()),
            "max": float(valid["hr_rs_deviation"].max()),
            "stability_cv": float(cv),
        }

        if len(valid) >= 5:
            valid = valid.sort_values("date")
            earlier_mean = valid.head(3)["hr_rs_deviation"].mean()
            recent_mean = valid.tail(3)["hr_rs_deviation"].mean()
            change_rate = ((recent_mean - earlier_mean) / earlier_mean * 100) if earlier_mean else 0.0
            result["recent_change_pct"] = float(change_rate)

        if len(valid) >= 10:
            result["corr_speed"] = float(valid["hr_rs_deviation"].corr(valid["avg_speed"]))
            result["corr_hr"] = float(valid["hr_rs_deviation"].corr(valid["heart_rate"]))
            result["corr_vo2"] = float(valid["hr_rs_deviation"].corr(valid["vo2max"]))

        return result
    
    def calculate_recovery_and_readiness(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df

        result = df.copy()
        if "resting_hr" not in result.columns:
            result["resting_hr"] = pd.Series(np.nan, index=result.index)
        if "sleep_quality" not in result.columns:
            result["sleep_quality"] = 3
        if "fatigue_level" not in result.columns:
            result["fatigue_level"] = 5

        rhr_baseline = result["resting_hr"].dropna().mean() if result["resting_hr"].notna().any() else 60
        trimp_baseline = result["TRIMP"].rolling(window=4, min_periods=1).mean()

        result["rhr_score"] = 1 - ((result["resting_hr"] - rhr_baseline) / rhr_baseline)
        result["load_score"] = 1 - (result["TRIMP"] / (trimp_baseline + 1e-8))
        result["sleep_score"] = result["sleep_quality"] / 5
        result["fatigue_score"] = 1 - (result["fatigue_level"] / 10)

        for col in ["rhr_score", "load_score", "sleep_score", "fatigue_score"]:
            result[col] = result[col].clip(0, 1)

        result["recovery_score"] = (
            0.3 * result["rhr_score"].fillna(1)
            + 0.3 * result["load_score"].fillna(1)
            + 0.2 * result["sleep_score"].fillna(0.6)
            + 0.2 * result["fatigue_score"].fillna(0.5)
        )
        result["readiness_score"] = (
            0.5 * result["recovery_score"]
            + 0.3 * result["load_score"].fillna(1)
            + 0.2 * result["sleep_score"].fillna(0.6)
        )
        result["recovery_score"] = result["recovery_score"].clip(0, 1)
        result["readiness_score"] = result["readiness_score"].clip(0, 1)
        return result

    def calculate_training_score(self, df: pd.DataFrame) -> dict | None:
        if df.empty:
            return None

        metrics = {
            "running_economy": {"weight": 0.25, "higher_is_better": True},
            "vo2max": {"weight": 0.20, "higher_is_better": True},
            "distance": {"weight": 0.15, "higher_is_better": True},
            "efficiency_score": {"weight": 0.20, "higher_is_better": True},
            "heart_rate": {"weight": 0.20, "higher_is_better": False},
        }

        normalized_scores = {}
        weighted_scores = {}
        for metric, config in metrics.items():
            normalized_scores[metric] = self.normalize_metric(df[metric], config["higher_is_better"])
            weighted_scores[metric] = normalized_scores[metric] * config["weight"]

        overall_score = sum(weighted_scores[m].mean() for m in metrics) * 100
        date_num = df["date"].map(pd.Timestamp.toordinal)

        return {
            "overall_score": float(overall_score),
            "metric_breakdown": {
                metric: {
                    "normalized_value": float(normalized_scores[metric].mean()),
                    "weighted_value": float(weighted_scores[metric].mean()),
                    "raw_mean": float(df[metric].mean()),
                    "raw_std": 0.0 if pd.isna(df[metric].std()) else float(df[metric].std()),
                }
                for metric in metrics
            },
            "performance_trends": {
                "running_economy_trend": self.safe_numeric_corr(normalized_scores["running_economy"], date_num),
                "distance_progression": self.safe_numeric_corr(normalized_scores["distance"], date_num),
            },
        }

    def calculate_session_scores(self, df: pd.DataFrame) -> pd.Series:
        if df.empty:
            return pd.Series(dtype=float)

        metrics = {
            "running_economy": {"weight": 0.25, "higher_is_better": True},
            "vo2max": {"weight": 0.20, "higher_is_better": True},
            "distance": {"weight": 0.15, "higher_is_better": True},
            "efficiency_score": {"weight": 0.20, "higher_is_better": True},
            "heart_rate": {"weight": 0.20, "higher_is_better": False},
        }

        total = pd.Series(0.0, index=df.index)
        for metric, config in metrics.items():
            total += self.normalize_metric(df[metric], config["higher_is_better"]) * config["weight"]
        return total * 100

    def calculate_monthly_metrics_averages(self, df: pd.DataFrame) -> pd.DataFrame | None:
        if df.empty:
            return None

        result = df.copy()
        result["year_month"] = result["date"].dt.to_period("M")

        metrics = [
            "running_economy",
            "vo2max",
            "distance",
            "efficiency_score",
            "heart_rate",
            "energy_cost",
            "TRIMP",
            "recovery_score",
            "readiness_score",
            "avg_speed",
            "max_speed",
            "speed_reserve",
            "hr_rs_deviation",
            "speed_efficiency",
            "pace_per_km",
            "economy_at_speed",
            "physio_efficiency",
            "fatigue_index",
        ]
        metrics = [m for m in metrics if m in result.columns]
        return result.groupby("year_month")[metrics].agg(["mean", "std", "count"])

    def get_monthly_session_counts(self, df: pd.DataFrame) -> dict:
        if df.empty:
            return {}
        return df.groupby(df["date"].dt.to_period("M")).size().to_dict()

    def build_metrics_breakdown_row(self, df: pd.DataFrame, training_score: dict) -> tuple:
        metrics = training_score.get("metric_breakdown", {})
        trends = training_score.get("performance_trends", {})

        def safe_metric_value(metric_dict: dict, key: str, default: float = 0.0) -> float:
            try:
                if metric_dict and key in metric_dict:
                    val = metric_dict[key]
                    return default if pd.isna(val) else float(val)
                return default
            except (TypeError, ValueError, KeyError):
                return default

        def safe_stat_from_df(col_name: str, stat_func: Callable[[pd.Series], float]) -> float:
            try:
                if col_name in df.columns:
                    result = stat_func(df[col_name])
                    return 0.0 if pd.isna(result) else float(result)
                return 0.0
            except Exception:
                return 0.0

        return (
            self.repository.today_string(),
            float(training_score["overall_score"]),
            safe_metric_value(metrics.get("running_economy", {}), "normalized_value"),
            safe_metric_value(metrics.get("running_economy", {}), "weighted_value"),
            safe_metric_value(metrics.get("running_economy", {}), "raw_mean"),
            safe_metric_value(metrics.get("running_economy", {}), "raw_std"),
            safe_metric_value(metrics.get("vo2max", {}), "normalized_value"),
            safe_metric_value(metrics.get("vo2max", {}), "weighted_value"),
            safe_metric_value(metrics.get("vo2max", {}), "raw_mean"),
            safe_metric_value(metrics.get("vo2max", {}), "raw_std"),
            safe_metric_value(metrics.get("distance", {}), "normalized_value"),
            safe_metric_value(metrics.get("distance", {}), "weighted_value"),
            safe_metric_value(metrics.get("distance", {}), "raw_mean"),
            safe_metric_value(metrics.get("distance", {}), "raw_std"),
            safe_metric_value(metrics.get("efficiency_score", {}), "normalized_value"),
            safe_metric_value(metrics.get("efficiency_score", {}), "weighted_value"),
            safe_metric_value(metrics.get("efficiency_score", {}), "raw_mean"),
            safe_metric_value(metrics.get("efficiency_score", {}), "raw_std"),
            safe_metric_value(metrics.get("heart_rate", {}), "normalized_value"),
            safe_metric_value(metrics.get("heart_rate", {}), "weighted_value"),
            safe_metric_value(metrics.get("heart_rate", {}), "raw_mean"),
            safe_metric_value(metrics.get("heart_rate", {}), "raw_std"),
            safe_metric_value(trends, "running_economy_trend"),
            safe_metric_value(trends, "distance_progression"),
            safe_stat_from_df("avg_speed", pd.Series.mean),
            safe_stat_from_df("avg_speed", pd.Series.std),
            safe_stat_from_df("max_speed", pd.Series.mean),
            safe_stat_from_df("max_speed", pd.Series.std),
            safe_stat_from_df("speed_reserve", pd.Series.mean),
            safe_stat_from_df("speed_reserve", pd.Series.std),
            safe_stat_from_df("speed_consistency", pd.Series.mean),
            safe_stat_from_df("speed_consistency", pd.Series.std),
            safe_stat_from_df("pace_per_km", pd.Series.mean),
            safe_stat_from_df("pace_per_km", pd.Series.std),
            safe_stat_from_df("speed_efficiency", pd.Series.mean),
            safe_stat_from_df("speed_efficiency", pd.Series.std),
            safe_stat_from_df("economy_at_speed", pd.Series.mean),
            safe_stat_from_df("economy_at_speed", pd.Series.std),
            safe_stat_from_df("speed_vo2max_index", pd.Series.mean),
            safe_stat_from_df("speed_vo2max_index", pd.Series.std),
            safe_stat_from_df("hr_rs_deviation", pd.Series.mean),
            safe_stat_from_df("hr_rs_deviation", pd.Series.std),
            safe_stat_from_df("cardiac_drift", pd.Series.mean),
            safe_stat_from_df("cardiac_drift", pd.Series.std),
            safe_stat_from_df("physio_efficiency", pd.Series.mean),
            safe_stat_from_df("physio_efficiency", pd.Series.std),
            safe_stat_from_df("fatigue_index", pd.Series.mean),
            safe_stat_from_df("fatigue_index", pd.Series.std),
        )

    def detect_anomalies(self, df: pd.DataFrame, weekly_trimp: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
        if df.empty:
            return pd.DataFrame(), {}

        out = df.copy()
        out["hr_rs_z"] = 0.0

        std = out["hr_rs_deviation"].std(ddof=0)
        if std and not pd.isna(std):
            out["hr_rs_z"] = (out["hr_rs_deviation"] - out["hr_rs_deviation"].mean()) / std

        acwr_map = {}
        if not weekly_trimp.empty:
            acwr_map = dict(zip(weekly_trimp["week_label"], weekly_trimp["acwr"]))

        out["acwr"] = out["week_label"].map(acwr_map).fillna(0)

        fatigue_threshold = out["fatigue_index"].quantile(0.90) if "fatigue_index" in out.columns else 0
        hr_rs_threshold = out["hr_rs_deviation"].quantile(0.90) if "hr_rs_deviation" in out.columns else 0

        out["fatigue_flag"] = (
            (out["recovery_score"] < 0.45)
            | (out["readiness_score"] < 0.50)
            | (out["hr_rs_z"] > 1.5)
            | (out["fatigue_index"] > fatigue_threshold)
        )

        out["overtraining_flag"] = (
            (out["acwr"] > 1.3)
            | ((out["recovery_score"] < 0.35) & (out["readiness_score"] < 0.45))
            | (
                (out["hr_rs_deviation"] > hr_rs_threshold)
                & (out["avg_speed"] < out["avg_speed"].rolling(5, min_periods=1).mean())
            )
        )

        out["risk_level"] = np.select(
            [out["overtraining_flag"], out["fatigue_flag"]],
            ["High", "Medium"],
            default="Low",
        )

        summary = {
            "fatigue_flag_count": int(out["fatigue_flag"].sum()),
            "overtraining_flag_count": int(out["overtraining_flag"].sum()),
            "high_risk_latest": bool(out.iloc[-1]["risk_level"] == "High"),
            "medium_risk_latest": bool(out.iloc[-1]["risk_level"] == "Medium"),
        }
        return out, summary