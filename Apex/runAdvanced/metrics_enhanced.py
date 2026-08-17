from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

from repository_enhanced import RunningRepository


class RunningMetricsService:
    """
    Calculates derived running metrics, training load, recovery/readiness,
    composite scores, and anomaly/risk flags for a personal running dashboard.

    Notes:
    - ``time`` is assumed to be duration in minutes.
    - ``avg_speed`` is assumed to be km/h because pace is calculated as 60 / speed.
    - Rolling 7-day metrics are true calendar-day windows when ``date`` is available,
      not simply the previous 7 rows/sessions.
    """

    # Stable reference ranges keep scores comparable as new runs are added.
    # Adjust these to match your fitness level, device units, and long-term goals.
    DEFAULT_REFERENCE_RANGES: dict[str, tuple[float, float]] = {
        "running_economy": (100.0, 300.0),
        "vo2max": (30.0, 65.0),
        "distance": (0.0, 30.0),
        "efficiency_score": (0.0, 8.0),
        "heart_rate": (120.0, 190.0),
    }

    TRAINING_SCORE_METRICS: dict[str, dict[str, float | bool]] = {
        "running_economy": {"weight": 0.25, "higher_is_better": True},
        "vo2max": {"weight": 0.20, "higher_is_better": True},
        "distance": {"weight": 0.15, "higher_is_better": True},
        "efficiency_score": {"weight": 0.20, "higher_is_better": True},
        "heart_rate": {"weight": 0.20, "higher_is_better": False},
    }

    def __init__(
        self,
        repository: RunningRepository,
        rest_hr: int = 60,
        max_hr: int = 190,
        reference_ranges: dict[str, tuple[float, float]] | None = None,
    ) -> None:
        self.repository = repository
        self.rest_hr = rest_hr
        self.max_hr = max_hr
        self.reference_ranges = {
            **self.DEFAULT_REFERENCE_RANGES,
            **(reference_ranges or {}),
        }

    @staticmethod
    def normalize_metric(series: pd.Series, higher_is_better: bool) -> pd.Series:
        """
        Dataset-relative min/max normalization.

        This is still useful for exploratory comparisons, but production scoring
        uses ``normalize_metric_fixed_range`` so historical scores do not change
        when a new best/worst session is added.
        """
        series = pd.to_numeric(series, errors="coerce")
        min_val = series.min()
        max_val = series.max()
        range_val = max_val - min_val

        if pd.isna(range_val) or range_val == 0:
            return pd.Series(0.5, index=series.index, dtype=float)

        normalized = (series - min_val) / range_val
        return normalized if higher_is_better else 1 - normalized

    @staticmethod
    def normalize_metric_fixed_range(
        series: pd.Series,
        lower_bound: float,
        upper_bound: float,
        higher_is_better: bool,
    ) -> pd.Series:
        """
        Stable normalization against a fixed physiological/reference range.
        Values outside the range are clipped to 0..1.
        """
        series = pd.to_numeric(series, errors="coerce")
        if upper_bound <= lower_bound:
            return pd.Series(0.5, index=series.index, dtype=float)

        normalized = (series - lower_bound) / (upper_bound - lower_bound)
        normalized = normalized.clip(0, 1)
        return normalized if higher_is_better else 1 - normalized

    @staticmethod
    def safe_numeric_corr(series_a: pd.Series, series_b: pd.Series) -> float:
        valid = pd.concat([series_a, series_b], axis=1).dropna()
        if len(valid) < 2:
            return 0.0
        corr = valid.iloc[:, 0].corr(valid.iloc[:, 1])
        return 0.0 if pd.isna(corr) else float(corr)

    @staticmethod
    def _rolling_time_mean(
        df: pd.DataFrame,
        value_col: str,
        window: str = "7D",
        date_col: str = "date",
    ) -> pd.Series:
        """
        Calendar-time rolling mean aligned back to the original index.
        Falls back to session-count rolling if date data is unavailable.
        """
        if df.empty or value_col not in df.columns:
            return pd.Series(dtype=float, index=df.index)

        if date_col not in df.columns or df[date_col].isna().all():
            return df[value_col].rolling(window=7, min_periods=1).mean()

        ordered = df[[date_col, value_col]].copy()
        ordered[value_col] = pd.to_numeric(ordered[value_col], errors="coerce")
        ordered = ordered.sort_values(date_col)
        rolled = (
            ordered.set_index(date_col)[value_col]
            .rolling(window, min_periods=1)
            .mean()
        )
        return rolled.reset_index(drop=True).set_axis(ordered.index).reindex(df.index)

    @staticmethod
    def _daily_loads(df: pd.DataFrame) -> pd.DataFrame:
        """
        Build daily TRIMP loads using calendar days.

        Important: raw Garmin/Artemis dates usually include time-of-day.  A direct
        merge from daily resampled rows back to session timestamps will not match.
        This method normalizes timestamps to midnight and returns a `session_day`
        key that can be merged safely back to each session.
        """
        if df.empty or "date" not in df.columns or "TRIMP" not in df.columns:
            return pd.DataFrame(columns=["session_day", "daily_trimp"])

        tmp = df[["date", "TRIMP"]].copy()
        tmp["date"] = pd.to_datetime(tmp["date"], errors="coerce")
        tmp["TRIMP"] = pd.to_numeric(tmp["TRIMP"], errors="coerce").fillna(0.0)
        tmp = tmp.dropna(subset=["date"])
        if tmp.empty:
            return pd.DataFrame(columns=["session_day", "daily_trimp"])

        tmp["session_day"] = tmp["date"].dt.floor("D")
        daily = (
            tmp.groupby("session_day", as_index=True)["TRIMP"]
            .sum()
            .sort_index()
            .asfreq("D", fill_value=0.0)
            .rename("daily_trimp")
            .reset_index()
        )
        return daily

    def _normalized_training_components(self, df: pd.DataFrame) -> tuple[dict[str, pd.Series], dict[str, pd.Series]]:
        normalized_scores: dict[str, pd.Series] = {}
        weighted_scores: dict[str, pd.Series] = {}

        for metric, config in self.TRAINING_SCORE_METRICS.items():
            lower, upper = self.reference_ranges.get(
                metric,
                (float(df[metric].min()), float(df[metric].max())),
            )
            normalized_scores[metric] = self.normalize_metric_fixed_range(
                df[metric],
                lower_bound=lower,
                upper_bound=upper,
                higher_is_better=bool(config["higher_is_better"]),
            )
            weighted_scores[metric] = normalized_scores[metric] * float(config["weight"])

        return normalized_scores, weighted_scores

    def load_training_log(self) -> tuple[pd.DataFrame, pd.DataFrame]:
        df = self.repository.load_running_sessions()
        if df.empty:
            return pd.DataFrame(), pd.DataFrame()

        df = df.copy()
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df = df.sort_values("date").reset_index(drop=True)
        df["session_day"] = df["date"].dt.floor("D")

        numeric_cols = [
            "time",
            "vo2max",
            "running_economy",
            "distance",
            "max_speed",
            "avg_speed",
            "heart_rate",
            "hr_rs_deviation",
            "cardiac_drift",
        ]
        for col in numeric_cols:
            if col not in df.columns:
                df[col] = 0.0
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

        # Assumption: time is minutes
        df["duration_min"] = df["time"].clip(lower=0)
        df["duration_hr"] = df["duration_min"] / 60.0

        df["efficiency_score"] = np.where(df["vo2max"] > 0, df["running_economy"] / df["vo2max"], 0)
        df["energy_cost"] = np.where(df["time"] > 0, df["running_economy"] * (df["distance"] / df["time"]), 0)
        df["speed_reserve"] = df["max_speed"] - df["avg_speed"]
        df["speed_consistency"] = np.where(df["max_speed"] > 0, df["avg_speed"] / df["max_speed"], 0)
        df["pace_per_km"] = np.where(df["avg_speed"] > 0, 60.0 / df["avg_speed"], 0)
        df["speed_efficiency"] = np.where(df["heart_rate"] > 0, df["avg_speed"] / df["heart_rate"], 0)
        df["economy_at_speed"] = np.where(df["avg_speed"] > 0, df["running_economy"] / df["avg_speed"], 0)
        df["speed_vo2max_index"] = df["avg_speed"] * df["vo2max"]

        # Extra "best platform" style metrics.
        df["efficiency_factor"] = df["speed_efficiency"]
        df["performance_index"] = np.where(
            df["heart_rate"] > 0,
            df["avg_speed"] * (df["running_economy"] / df["heart_rate"]),
            0,
        )

        # Session-level aerobic decoupling.
        # Preferred: first/second half HR and speed. Fallback: Garmin/Artemis cardiac_drift.
        half_cols = ["first_half_hr", "second_half_hr", "first_half_speed", "second_half_speed"]
        for col in half_cols:
            if col not in df.columns:
                df[col] = np.nan
            df[col] = pd.to_numeric(df[col], errors="coerce")

        first_ratio = np.where(df["first_half_speed"] > 0, df["first_half_hr"] / df["first_half_speed"], np.nan)
        second_ratio = np.where(df["second_half_speed"] > 0, df["second_half_hr"] / df["second_half_speed"], np.nan)
        decoupling_from_halves = np.where(
            first_ratio > 0,
            ((second_ratio - first_ratio) / first_ratio) * 100,
            np.nan,
        )
        df["aerobic_decoupling_pct"] = pd.Series(decoupling_from_halves, index=df.index)
        df["aerobic_decoupling_pct"] = df["aerobic_decoupling_pct"].fillna(df["cardiac_drift"])

        hr_denominator = max(self.max_hr - self.rest_hr, 1)
        hr_ratio = (df["heart_rate"] - self.rest_hr) / hr_denominator
        df["hr_ratio"] = hr_ratio.clip(lower=0, upper=1)
        df["TRIMP"] = df["duration_min"] * df["hr_ratio"]

        df["physio_efficiency"] = np.where(
            (df["hr_rs_deviation"] > 0) & (df["heart_rate"] > 0),
            (df["avg_speed"] / df["heart_rate"]) * (1 / df["hr_rs_deviation"]),
            0,
        )

        # Use only positive drift as fatigue; negative drift is not treated as negative fatigue.
        positive_drift = df["cardiac_drift"].clip(lower=0)
        df["fatigue_index"] = np.where(
            df["avg_speed"] > 0,
            (df["hr_rs_deviation"].clip(lower=0) * positive_drift) / df["avg_speed"],
            0,
        )

        df["speed_zone"] = pd.cut(
            df["avg_speed"],
            bins=[0, 10, 14, np.inf],
            labels=["Slow", "Moderate", "Fast"],
            include_lowest=True,
        )

        iso = df["date"].dt.isocalendar()
        df["iso_year"] = iso.year.fillna(0).astype(int)
        df["iso_week"] = iso.week.fillna(0).astype(int)
        df["week_label"] = df["iso_year"].astype(str) + "-W" + df["iso_week"].astype(str).str.zfill(2)

        daily_load = self._daily_loads(df.dropna(subset=["date"]))
        if not daily_load.empty:
            daily_load["acute_load_7d"] = daily_load["daily_trimp"].rolling(window=7, min_periods=1).sum()
            daily_load["chronic_load_28d"] = daily_load["daily_trimp"].rolling(window=28, min_periods=1).sum()
            daily_load["acwr_7_28"] = np.where(
                daily_load["chronic_load_28d"] > 0,
                daily_load["acute_load_7d"] / (daily_load["chronic_load_28d"] / 4.0),
                0,
            )
            daily_load["weekly_monotony"] = (
                daily_load["daily_trimp"].rolling(window=7, min_periods=2).mean()
                / daily_load["daily_trimp"].rolling(window=7, min_periods=2).std().replace(0, np.nan)
            ).replace([np.inf, -np.inf], np.nan).fillna(0)
            daily_load["weekly_strain"] = daily_load["acute_load_7d"] * daily_load["weekly_monotony"]

            load_cols = ["session_day", "acute_load_7d", "chronic_load_28d", "acwr_7_28", "weekly_monotony", "weekly_strain"]
            df = df.merge(daily_load[load_cols], on="session_day", how="left")
            for col in ["acute_load_7d", "chronic_load_28d", "acwr_7_28", "weekly_monotony", "weekly_strain"]:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        else:
            df["acute_load_7d"] = 0.0
            df["chronic_load_28d"] = 0.0
            df["acwr_7_28"] = 0.0
            df["weekly_monotony"] = 0.0
            df["weekly_strain"] = 0.0

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
        if not daily_load.empty:
            weekly_enhanced = (
                df.groupby(["iso_year", "iso_week", "week_label"], as_index=False)[
                    ["acute_load_7d", "chronic_load_28d", "acwr_7_28", "weekly_monotony", "weekly_strain"]
                ]
                .last()
            )
            weekly_trimp = weekly_trimp.merge(
                weekly_enhanced,
                on=["iso_year", "iso_week", "week_label"],
                how="left",
            )

        # Calendar-time rolling means, not "last 7 sessions".
        df["trimp_rolling_7"] = self._rolling_time_mean(df, "TRIMP", "7D")
        df["speed_rolling_7"] = self._rolling_time_mean(df, "avg_speed", "7D")
        df["hr_rs_rolling_7"] = self._rolling_time_mean(df, "hr_rs_deviation", "7D")

        # Recovery/readiness is added here so downstream methods can use it safely.
        df = self.calculate_recovery_and_readiness(df)

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
            "efficiency_factor_mean": float(data["efficiency_factor"].mean()) if "efficiency_factor" in data else 0.0,
            "performance_index_mean": float(data["performance_index"].mean()) if "performance_index" in data else 0.0,
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

        # Correlations are more stable with more observations.
        if len(valid) >= 20:
            result["corr_speed"] = self.safe_numeric_corr(valid["hr_rs_deviation"], valid["avg_speed"])
            result["corr_hr"] = self.safe_numeric_corr(valid["hr_rs_deviation"], valid["heart_rate"])
            result["corr_vo2"] = self.safe_numeric_corr(valid["hr_rs_deviation"], valid["vo2max"])
        elif len(valid) >= 10:
            result["corr_note"] = "Not reported: fewer than 20 valid observations."

        return result

    def calculate_recovery_and_readiness(self, df: pd.DataFrame) -> pd.DataFrame:
        if df.empty:
            return df

        result = df.copy()
        has_resting_hr = "resting_hr" in result.columns and result["resting_hr"].notna().any()
        has_sleep = "sleep_quality" in result.columns and result["sleep_quality"].notna().any()
        has_fatigue = "fatigue_level" in result.columns and result["fatigue_level"].notna().any()

        if "resting_hr" not in result.columns:
            result["resting_hr"] = np.nan
        if "sleep_quality" not in result.columns:
            result["sleep_quality"] = np.nan
        if "fatigue_level" not in result.columns:
            result["fatigue_level"] = np.nan

        result["resting_hr"] = pd.to_numeric(result["resting_hr"], errors="coerce")
        result["sleep_quality"] = pd.to_numeric(result["sleep_quality"], errors="coerce")
        result["fatigue_level"] = pd.to_numeric(result["fatigue_level"], errors="coerce")

        rhr_baseline = result["resting_hr"].dropna().mean() if has_resting_hr else np.nan
        trimp_baseline = result["TRIMP"].rolling(window=4, min_periods=1).mean()

        result["rhr_score"] = np.nan
        if has_resting_hr and rhr_baseline and not pd.isna(rhr_baseline):
            result["rhr_score"] = 1 - ((result["resting_hr"] - rhr_baseline) / rhr_baseline)

        result["load_score"] = 1 - (result["TRIMP"] / (trimp_baseline + 1e-8))
        result["sleep_score"] = result["sleep_quality"] / 5 if has_sleep else np.nan
        result["fatigue_score"] = 1 - (result["fatigue_level"] / 10) if has_fatigue else np.nan

        for col in ["rhr_score", "load_score", "sleep_score", "fatigue_score"]:
            result[col] = result[col].clip(0, 1)

        # Dynamically re-weight based on available signals instead of hard-coding
        # average sleep/fatigue defaults when those inputs are missing.
        recovery_components = {
            "rhr_score": 0.30,
            "load_score": 0.30,
            "sleep_score": 0.20,
            "fatigue_score": 0.20,
        }
        readiness_components = {
            "recovery_score": 0.50,
            "load_score": 0.30,
            "sleep_score": 0.20,
        }

        recovery_numerator = pd.Series(0.0, index=result.index)
        recovery_denominator = pd.Series(0.0, index=result.index)
        for col, weight in recovery_components.items():
            valid = result[col].notna()
            recovery_numerator += result[col].fillna(0) * weight
            recovery_denominator += valid.astype(float) * weight

        result["recovery_score"] = np.where(
            recovery_denominator > 0,
            recovery_numerator / recovery_denominator,
            np.nan,
        )

        readiness_numerator = pd.Series(0.0, index=result.index)
        readiness_denominator = pd.Series(0.0, index=result.index)
        for col, weight in readiness_components.items():
            valid = result[col].notna()
            readiness_numerator += result[col].fillna(0) * weight
            readiness_denominator += valid.astype(float) * weight

        result["readiness_score"] = np.where(
            readiness_denominator > 0,
            readiness_numerator / readiness_denominator,
            np.nan,
        )

        result["recovery_score"] = pd.Series(result["recovery_score"], index=result.index).clip(0, 1)
        result["readiness_score"] = pd.Series(result["readiness_score"], index=result.index).clip(0, 1)
        return result

    def calculate_training_score(self, df: pd.DataFrame) -> dict | None:
        if df.empty:
            return None

        normalized_scores, weighted_scores = self._normalized_training_components(df)
        overall_score = sum(weighted_scores[m].mean() for m in self.TRAINING_SCORE_METRICS) * 100
        date_num = df["date"].map(pd.Timestamp.toordinal)

        return {
            "overall_score": float(overall_score),
            "metric_breakdown": {
                metric: {
                    "normalized_value": float(normalized_scores[metric].mean()),
                    "weighted_value": float(weighted_scores[metric].mean()),
                    "raw_mean": float(df[metric].mean()),
                    "raw_std": 0.0 if pd.isna(df[metric].std()) else float(df[metric].std()),
                    "reference_range": self.reference_ranges.get(metric),
                }
                for metric in self.TRAINING_SCORE_METRICS
            },
            "performance_trends": {
                "running_economy_trend": self.safe_numeric_corr(normalized_scores["running_economy"], date_num),
                "distance_progression": self.safe_numeric_corr(normalized_scores["distance"], date_num),
            },
        }

    def calculate_session_scores(self, df: pd.DataFrame) -> pd.Series:
        if df.empty:
            return pd.Series(dtype=float)

        _, weighted_scores = self._normalized_training_components(df)
        total = pd.Series(0.0, index=df.index)
        for metric in self.TRAINING_SCORE_METRICS:
            total += weighted_scores[metric]
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
            "acute_load_7d",
            "chronic_load_28d",
            "acwr_7_28",
            "weekly_monotony",
            "weekly_strain",
            "recovery_score",
            "readiness_score",
            "avg_speed",
            "max_speed",
            "speed_reserve",
            "hr_rs_deviation",
            "speed_efficiency",
            "efficiency_factor",
            "performance_index",
            "aerobic_decoupling_pct",
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
            safe_stat_from_df("efficiency_factor", pd.Series.mean),
            safe_stat_from_df("efficiency_factor", pd.Series.std),
            safe_stat_from_df("performance_index", pd.Series.mean),
            safe_stat_from_df("performance_index", pd.Series.std),
            safe_stat_from_df("aerobic_decoupling_pct", pd.Series.mean),
            safe_stat_from_df("aerobic_decoupling_pct", pd.Series.std),
            safe_stat_from_df("acwr_7_28", pd.Series.mean),
            safe_stat_from_df("acwr_7_28", pd.Series.std),
            safe_stat_from_df("weekly_monotony", pd.Series.mean),
            safe_stat_from_df("weekly_monotony", pd.Series.std),
            safe_stat_from_df("weekly_strain", pd.Series.mean),
            safe_stat_from_df("weekly_strain", pd.Series.std),
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
            acwr_col = "acwr_7_28" if "acwr_7_28" in weekly_trimp.columns else "acwr"
            acwr_map = dict(zip(weekly_trimp["week_label"], weekly_trimp[acwr_col]))

        out["acwr"] = out["week_label"].map(acwr_map).fillna(out.get("acwr_7_28", 0))

        fatigue_threshold = max(
            0.0,
            out["fatigue_index"].quantile(0.90) if "fatigue_index" in out.columns else 0.0,
        )
        hr_rs_relative_threshold = max(
            5.0,
            out["hr_rs_deviation"].median() * 1.20 if "hr_rs_deviation" in out.columns else 5.0,
        )

        recovery_low = out["recovery_score"].fillna(1) < 0.45
        readiness_low = out["readiness_score"].fillna(1) < 0.50

        out["fatigue_flag"] = (
            recovery_low
            | readiness_low
            | (out["hr_rs_z"] > 1.5)
            | (out["hr_rs_deviation"] > hr_rs_relative_threshold)
            | (out["fatigue_index"] > fatigue_threshold)
            | (out.get("weekly_monotony", 0) > 2.0)
        )

        out["overtraining_flag"] = (
            (out["acwr"] > 1.3)
            | ((out["acwr"] > 1.5) & (out.get("weekly_strain", 0) > out.get("weekly_strain", pd.Series(0, index=out.index)).quantile(0.75)))
            | ((out["recovery_score"].fillna(1) < 0.35) & (out["readiness_score"].fillna(1) < 0.45))
            | (
                (out["hr_rs_deviation"] > hr_rs_relative_threshold)
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
            "latest_acwr": float(out.iloc[-1]["acwr"]) if "acwr" in out.columns else 0.0,
            "latest_monotony": float(out.iloc[-1].get("weekly_monotony", 0.0)),
            "latest_strain": float(out.iloc[-1].get("weekly_strain", 0.0)),
        }
        return out, summary
