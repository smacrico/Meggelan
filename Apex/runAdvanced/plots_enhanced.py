from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


class RunningPlotter:
    def __init__(self, output_dir: str = "c:/temp/logsFitnessApp") -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _save_plot(self, filename: str) -> Path:
        path = self.output_dir / filename
        plt.savefig(path, dpi=300, bbox_inches="tight")
        print(f"Saved: {path}")
        return path

    def visualize_trends(self, df: pd.DataFrame) -> None:
        if df.empty:
            return

        plt.figure(figsize=(15, 10))

        plt.subplot(2, 2, 1)
        plt.plot(df["date"], df["running_economy"], "b-o")
        plt.title("Running Economy Trend")
        plt.xticks(rotation=45)
        plt.ylabel("Running Economy")

        plt.subplot(2, 2, 2)
        plt.plot(df["date"], df["efficiency_score"], "g-o")
        plt.title("Efficiency Score Trend")
        plt.xticks(rotation=45)
        plt.ylabel("Efficiency Score")

        plt.subplot(2, 2, 3)
        plt.scatter(df["distance"], df["energy_cost"])
        plt.title("Energy Cost vs Distance")
        plt.xlabel("Distance (km)")
        plt.ylabel("Energy Cost")

        plt.subplot(2, 2, 4)
        plt.scatter(df["heart_rate"], df["running_economy"])
        plt.title("Heart Rate vs Running Economy")
        plt.xlabel("Heart Rate (bpm)")
        plt.ylabel("Running Economy")

        plt.tight_layout()
        self._save_plot("trends.png")
        plt.show()

    def visualize_training_load(self, df: pd.DataFrame, weekly_trimp: pd.DataFrame) -> None:
        if df.empty:
            return

        fig, axes = plt.subplots(2, 2, figsize=(16, 10))

        axes[0, 0].plot(df["date"], df["TRIMP"], marker="o", label="Session TRIMP")
        if "acute_load_7d" in df.columns:
            axes[0, 0].plot(df["date"], df["acute_load_7d"], linestyle="--", label="Acute Load 7D")
        if "chronic_load_28d" in df.columns:
            axes[0, 0].plot(df["date"], df["chronic_load_28d"], linestyle="--", label="Chronic Load 28D")
        axes[0, 0].set_title("Session TRIMP and Calendar Training Loads")
        axes[0, 0].set_xlabel("Date")
        axes[0, 0].set_ylabel("Load")
        axes[0, 0].legend()
        axes[0, 0].tick_params(axis="x", rotation=45)
        axes[0, 0].grid(True, alpha=0.3)

        if not weekly_trimp.empty:
            weeks = weekly_trimp["week_label"]
            axes[0, 1].plot(weeks, weekly_trimp["weekly_trimp"], label="Weekly TRIMP", marker="o")
            if "acute_load_7d" in weekly_trimp.columns:
                axes[0, 1].plot(weeks, weekly_trimp["acute_load_7d"], label="Acute Load 7D", linestyle="--")
            else:
                axes[0, 1].plot(weeks, weekly_trimp["acute_load"], label="Acute Load", linestyle="--")
            if "chronic_load_28d" in weekly_trimp.columns:
                axes[0, 1].plot(weeks, weekly_trimp["chronic_load_28d"], label="Chronic Load 28D", linestyle="--")
            else:
                axes[0, 1].plot(weeks, weekly_trimp["chronic_load"], label="Chronic Load", linestyle="--")
            axes[0, 1].set_title("Weekly Load Summary")
            axes[0, 1].set_xlabel("ISO Week")
            axes[0, 1].set_ylabel("Load")
            axes[0, 1].legend()
            axes[0, 1].tick_params(axis="x", rotation=45)
            axes[0, 1].grid(True, alpha=0.3)

        acwr_col = "acwr_7_28" if "acwr_7_28" in df.columns else "acwr"
        if acwr_col in df.columns:
            axes[1, 0].plot(df["date"], df[acwr_col], marker="o", label=acwr_col.upper())
            axes[1, 0].axhline(1.3, linestyle=":", label="Caution 1.3")
            axes[1, 0].axhline(0.8, linestyle=":", label="Low load 0.8")
            axes[1, 0].set_title("ACWR 7/28 Monitor")
            axes[1, 0].set_xlabel("Date")
            axes[1, 0].set_ylabel("Ratio")
            axes[1, 0].legend()
            axes[1, 0].tick_params(axis="x", rotation=45)
            axes[1, 0].grid(True, alpha=0.3)

        if {"weekly_monotony", "weekly_strain"}.issubset(df.columns):
            ax = axes[1, 1]
            ax2 = ax.twinx()
            line1 = ax.plot(df["date"], df["weekly_monotony"], marker="o", label="Monotony")
            line2 = ax2.plot(df["date"], df["weekly_strain"], marker="s", linestyle="--", label="Strain")
            ax.axhline(2.0, linestyle=":", label="Monotony caution")
            ax.set_title("Training Monotony and Strain")
            ax.set_xlabel("Date")
            ax.set_ylabel("Monotony")
            ax2.set_ylabel("Strain")
            ax.tick_params(axis="x", rotation=45)
            ax.grid(True, alpha=0.3)
            lines = line1 + line2
            labels = [l.get_label() for l in lines]
            ax.legend(lines, labels, loc="upper left")

        plt.tight_layout()
        self._save_plot("training_load_enhanced.png")
        plt.show()

    def visualize_recovery_and_readiness(self, df: pd.DataFrame) -> None:
        if df.empty or "recovery_score" not in df.columns or "readiness_score" not in df.columns:
            return

        plt.figure(figsize=(12, 5))
        plt.plot(df["date"], df["recovery_score"], label="Recovery")
        plt.plot(df["date"], df["readiness_score"], label="Readiness")
        plt.axhline(0.7, color="orange", linestyle="--", label="Caution threshold")
        plt.xlabel("Date")
        plt.ylabel("Score (0–1)")
        plt.title("Recovery and Readiness Over Time")
        plt.legend()
        plt.tight_layout()
        self._save_plot("recovery_readiness.png")
        plt.show()

    def visualize_score_impact_over_time(
        self,
        df: pd.DataFrame,
        session_scores: pd.Series,
        extra_scores: dict | None = None,
    ) -> None:
        if df.empty:
            return

        plot_df = df.copy().sort_values("date")
        plot_df["Session Score"] = session_scores

        plt.figure(figsize=(14, 7))
        plt.plot(plot_df["date"], plot_df["Session Score"], label="Session Training Score", linewidth=2)

        if extra_scores:
            for label, col in extra_scores.items():
                if col in plot_df.columns:
                    plt.plot(plot_df["date"], plot_df[col], linestyle="--", label=label)

        plt.xlabel("Date")
        plt.ylabel("Score")
        plt.title("Comparison of Scoring Calculations Over Time")
        plt.legend()
        plt.tight_layout()
        self._save_plot("score_impact.png")
        plt.show()

    def visualize_speed_metrics(self, df: pd.DataFrame) -> None:
        if df.empty:
            return

        fig, axes = plt.subplots(3, 2, figsize=(16, 12))
        fig.suptitle("Speed Metrics Analysis", fontsize=16, fontweight="bold")

        ax1 = axes[0, 0]
        ax1.plot(df["date"], df["avg_speed"], marker="o", color="blue", label="Avg Speed")
        ax1.plot(df["date"], df["max_speed"], marker="s", color="red", alpha=0.6, label="Max Speed")
        ax1.set_title("Speed Trends Over Time")
        ax1.set_xlabel("Date")
        ax1.set_ylabel("Speed (km/h)")
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        ax1.tick_params(axis="x", rotation=45)

        ax2 = axes[0, 1]
        ax2.plot(df["date"], df["speed_reserve"], marker="o", color="green")
        ax2.set_title("Speed Reserve (Max - Avg)")
        ax2.set_xlabel("Date")
        ax2.set_ylabel("Speed Reserve (km/h)")
        ax2.grid(True, alpha=0.3)
        ax2.tick_params(axis="x", rotation=45)

        ax3 = axes[1, 0]
        date_color = df["date"].map(pd.Timestamp.toordinal)
        scatter = ax3.scatter(
            df["heart_rate"],
            df["avg_speed"],
            c=date_color,
            cmap="viridis",
            s=100,
            alpha=0.6,
        )
        ax3.set_title("Speed vs Heart Rate (colored by time)")
        ax3.set_xlabel("Heart Rate (bpm)")
        ax3.set_ylabel("Average Speed (km/h)")
        ax3.grid(True, alpha=0.3)
        plt.colorbar(scatter, ax=ax3, label="Date progression")

        ax4 = axes[1, 1]
        ax4.plot(df["date"], df["speed_efficiency"], marker="o", color="purple")
        ax4.set_title("Speed Efficiency (Speed per HR unit)")
        ax4.set_xlabel("Date")
        ax4.set_ylabel("Speed/HR (km/h per bpm)")
        ax4.grid(True, alpha=0.3)
        ax4.tick_params(axis="x", rotation=45)

        ax5 = axes[2, 0]
        ax5.plot(df["date"], df["pace_per_km"], marker="o", color="orange")
        ax5.set_title("Pace Progression")
        ax5.set_xlabel("Date")
        ax5.set_ylabel("Pace (min/km)")
        ax5.invert_yaxis()
        ax5.grid(True, alpha=0.3)
        ax5.tick_params(axis="x", rotation=45)

        ax6 = axes[2, 1]
        if "speed_zone" in df.columns:
            zone_counts = df["speed_zone"].value_counts()
            ax6.bar(zone_counts.index.astype(str), zone_counts.values, color=["#3498db", "#2ecc71", "#e74c3c"])
            ax6.set_title("Training Sessions by Speed Zone")
            ax6.set_xlabel("Speed Zone")
            ax6.set_ylabel("Number of Sessions")
            ax6.grid(True, alpha=0.3, axis="y")

        plt.tight_layout()
        self._save_plot("speed_metrics.png")
        plt.show()

    def visualize_hr_rs_deviation(self, df: pd.DataFrame) -> None:
        if df.empty:
            return

        valid_data = df[df["hr_rs_deviation"] > 0].copy()
        if valid_data.empty:
            return

        fig, axes = plt.subplots(2, 2, figsize=(16, 10))
        fig.suptitle("HR-RS Deviation Index Analysis", fontsize=16, fontweight="bold")

        ax1 = axes[0, 0]
        ax1.plot(valid_data["date"], valid_data["hr_rs_deviation"], marker="o", color="red", linewidth=2)
        rolling_avg = valid_data["hr_rs_deviation"].rolling(window=3, min_periods=1).mean()
        ax1.plot(valid_data["date"], rolling_avg, linestyle="--", color="blue", linewidth=2, label="3-session avg")
        ax1.set_title("HR-RS Deviation Index Over Time")
        ax1.set_xlabel("Date")
        ax1.set_ylabel("Deviation Index")
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        ax1.tick_params(axis="x", rotation=45)

        ax2 = axes[0, 1]
        ax2.scatter(valid_data["hr_rs_deviation"], valid_data["avg_speed"], s=100, alpha=0.6, c="green")
        ax2.set_title("HR-RS Deviation vs Speed Performance")
        ax2.set_xlabel("HR-RS Deviation Index")
        ax2.set_ylabel("Average Speed (km/h)")
        ax2.grid(True, alpha=0.3)

        if len(valid_data) >= 3 and valid_data["hr_rs_deviation"].nunique() > 1:
            z = np.polyfit(valid_data["hr_rs_deviation"], valid_data["avg_speed"], 1)
            p = np.poly1d(z)
            xvals = np.sort(valid_data["hr_rs_deviation"].values)
            ax2.plot(xvals, p(xvals), "r--", alpha=0.8, linewidth=2, label="Trend")
            ax2.legend()

        ax3 = axes[1, 0]
        ax3.hist(valid_data["hr_rs_deviation"], bins=15, color="purple", alpha=0.7, edgecolor="black")
        ax3.axvline(valid_data["hr_rs_deviation"].mean(), color="red", linestyle="--", linewidth=2, label="Mean")
        ax3.set_title("HR-RS Deviation Distribution")
        ax3.set_xlabel("Deviation Index")
        ax3.set_ylabel("Frequency")
        ax3.legend()
        ax3.grid(True, alpha=0.3, axis="y")

        ax4 = axes[1, 1]
        if "TRIMP" in valid_data.columns:
            ax4.scatter(valid_data["TRIMP"], valid_data["hr_rs_deviation"], s=100, alpha=0.6, c="orange")
            ax4.set_title("HR-RS Deviation vs Training Load (TRIMP)")
            ax4.set_xlabel("TRIMP Score")
            ax4.set_ylabel("HR-RS Deviation Index")
            ax4.grid(True, alpha=0.3)

        plt.tight_layout()
        self._save_plot("hr_rs_deviation.png")
        plt.show()

    def advanced_visualizations(self, df: pd.DataFrame) -> None:
        if df.empty:
            return

        work = df.copy().sort_values("date")
        work["cumulative_distance"] = work["distance"].cumsum()
        work["running_economy_ma"] = work["running_economy"].rolling(window=3, min_periods=1).mean()
        work["month"] = work["date"].dt.month

        plt.figure(figsize=(20, 15))

        plt.subplot(2, 3, 1)
        plt.plot(work["date"], work["cumulative_distance"], "b-o")
        plt.title("Cumulative Running Distance")
        plt.xlabel("Date")
        plt.ylabel("Total Distance (km)")
        plt.xticks(rotation=45)

        plt.subplot(2, 3, 2)
        plt.plot(work["date"], work["running_economy"], "g-", label="Original")
        plt.plot(work["date"], work["running_economy_ma"], "r-", label="3-Session Moving Avg")
        plt.title("Running Economy Trend")
        plt.xlabel("Date")
        plt.ylabel("Running Economy")
        plt.legend()
        plt.xticks(rotation=45)

        plt.subplot(2, 3, 3)
        pace = np.where(work["distance"] > 0, work["time"] / work["distance"], np.nan)
        plt.scatter(pace, work["heart_rate"], alpha=0.7)
        plt.title("Pace vs Heart Rate")
        plt.xlabel("Pace (min/km)")
        plt.ylabel("Heart Rate (bpm)")

        plt.subplot(2, 3, 4)
        try:
            if "speed_zone" in work.columns:
                zone_counts = work["speed_zone"].astype(str).value_counts()
                if not zone_counts.empty:
                    plt.pie(
                        zone_counts.values,
                        labels=zone_counts.index,
                        autopct="%1.1f%%",
                    )
                    plt.title("Training Zones Distribution")
                else:
                    plt.text(0.5, 0.5, "No valid zone data", ha="center", va="center")
            else:
                plt.text(0.5, 0.5, "No speed zone data", ha="center", va="center")
        except Exception:
            plt.text(0.5, 0.5, "Error creating pie chart", ha="center", va="center")

        plt.subplot(2, 3, 5, polar=True)
        metrics = [
            "running_economy",
            "vo2max",
            "distance",
            "efficiency_score",
            "heart_rate",
        ]
        normalized_metrics = pd.DataFrame({
            metric: self._normalize_metric(work[metric], higher_is_better=(metric != "heart_rate"))
            for metric in metrics
        })
        avg_metrics = normalized_metrics.mean()

        angles = np.linspace(0, 2 * np.pi, len(metrics), endpoint=False)
        values = avg_metrics.values
        values = np.concatenate((values, [values[0]]))
        angles = np.concatenate((angles, [angles[0]]))

        plt.polar(angles, values, "o-", linewidth=2)
        plt.fill(angles, values, alpha=0.25)
        plt.xticks(angles[:-1], metrics)
        plt.title("Performance Metrics Radar Chart")

        plt.subplot(2, 3, 6)
        seasonal_performance = work.groupby("month")["running_economy"].mean()
        if not seasonal_performance.empty:
            plt.imshow([seasonal_performance.values], cmap="YlOrRd", aspect="auto")
            plt.colorbar(label="Avg Running Economy")
            plt.title("Seasonal Performance Heatmap")
            plt.xlabel("Month")
            plt.xticks(range(len(seasonal_performance)), seasonal_performance.index)
        else:
            plt.text(0.5, 0.5, "No seasonal data", ha="center", va="center")

        plt.tight_layout()
        self._save_plot("advanced_metrics.png")
        plt.show()

    def create_performance_dashboard(self, df: pd.DataFrame) -> None:
        if df.empty:
            return

        fig = plt.figure(figsize=(20, 12))
        gs = fig.add_gridspec(4, 3, hspace=0.3, wspace=0.3)
        fig.suptitle("Comprehensive Running Performance Dashboard", fontsize=18, fontweight="bold")

        ax1 = fig.add_subplot(gs[0, 0])
        ax1.plot(df["date"], df["avg_speed"], marker="o", color="blue")
        ax1.set_title("Average Speed Trend")
        ax1.set_ylabel("Speed (km/h)")
        ax1.tick_params(axis="x", rotation=45)
        ax1.grid(True, alpha=0.3)

        ax2 = fig.add_subplot(gs[0, 1])
        ax2.plot(df["date"], df["speed_reserve"], marker="o", color="green")
        ax2.set_title("Speed Reserve")
        ax2.set_ylabel("km/h")
        ax2.tick_params(axis="x", rotation=45)
        ax2.grid(True, alpha=0.3)

        ax3 = fig.add_subplot(gs[0, 2])
        ax3.plot(df["date"], df["pace_per_km"], marker="o", color="orange")
        ax3.set_title("Pace")
        ax3.set_ylabel("min/km")
        ax3.invert_yaxis()
        ax3.tick_params(axis="x", rotation=45)
        ax3.grid(True, alpha=0.3)

        valid_hr_rs = df[df["hr_rs_deviation"] > 0]

        ax4 = fig.add_subplot(gs[1, 0])
        if not valid_hr_rs.empty:
            ax4.plot(valid_hr_rs["date"], valid_hr_rs["hr_rs_deviation"], marker="o", color="red")
        ax4.set_title("HR-RS Deviation Index")
        ax4.set_ylabel("Index")
        ax4.tick_params(axis="x", rotation=45)
        ax4.grid(True, alpha=0.3)

        ax5 = fig.add_subplot(gs[1, 1])
        if not valid_hr_rs.empty:
            ax5.scatter(valid_hr_rs["hr_rs_deviation"], valid_hr_rs["avg_speed"], s=100, alpha=0.6, c="purple")
        ax5.set_title("Deviation vs Speed")
        ax5.set_xlabel("HR-RS Deviation")
        ax5.set_ylabel("Speed (km/h)")
        ax5.grid(True, alpha=0.3)

        ax6 = fig.add_subplot(gs[1, 2])
        if not valid_hr_rs.empty:
            ax6.hist(valid_hr_rs["hr_rs_deviation"], bins=15, color="purple", alpha=0.7, edgecolor="black")
        ax6.set_title("Deviation Distribution")
        ax6.set_xlabel("Index")
        ax6.grid(True, alpha=0.3, axis="y")

        ax7 = fig.add_subplot(gs[2, 0])
        ax7.plot(df["date"], df["speed_efficiency"], marker="o", color="teal")
        ax7.set_title("Speed Efficiency (Speed/HR)")
        ax7.set_ylabel("km/h per bpm")
        ax7.tick_params(axis="x", rotation=45)
        ax7.grid(True, alpha=0.3)

        ax8 = fig.add_subplot(gs[2, 1])
        ax8.plot(df["date"], df["economy_at_speed"], marker="o", color="brown")
        ax8.set_title("Economy at Speed")
        ax8.set_ylabel("RE / Speed")
        ax8.tick_params(axis="x", rotation=45)
        ax8.grid(True, alpha=0.3)

        ax9 = fig.add_subplot(gs[2, 2])
        if "physio_efficiency" in df.columns:
            valid_physio = df[df["physio_efficiency"] > 0]
            if not valid_physio.empty:
                ax9.plot(valid_physio["date"], valid_physio["physio_efficiency"], marker="o", color="darkgreen")
        ax9.set_title("Physiological Efficiency")
        ax9.set_ylabel("Composite Score")
        ax9.tick_params(axis="x", rotation=45)
        ax9.grid(True, alpha=0.3)

        ax10 = fig.add_subplot(gs[3, :2])
        ax10_twin = ax10.twinx()

        line1 = ax10.plot(df["date"], df["avg_speed"], marker="o", color="blue", label="Avg Speed")
        line2 = ax10_twin.plot(df["date"], df["heart_rate"], marker="s", color="red", alpha=0.6, label="Heart Rate")

        ax10.set_title("Speed vs Heart Rate Over Time")
        ax10.set_xlabel("Date")
        ax10.set_ylabel("Speed (km/h)", color="blue")
        ax10_twin.set_ylabel("Heart Rate (bpm)", color="red")
        ax10.tick_params(axis="x", rotation=45)
        ax10.grid(True, alpha=0.3)

        lines = line1 + line2
        labels = [l.get_label() for l in lines]
        ax10.legend(lines, labels, loc="upper left")

        ax11 = fig.add_subplot(gs[3, 2])
        if "speed_zone" in df.columns:
            zone_counts = df["speed_zone"].value_counts()
            if not zone_counts.empty:
                ax11.pie(zone_counts.values, labels=zone_counts.index.astype(str), autopct="%1.1f%%", startangle=90)
        ax11.set_title("Speed Zone Distribution")

        self._save_plot("performance_dashboard.png")
        plt.show()


    def visualize_enhanced_metrics(self, df: pd.DataFrame) -> None:
        """Create plots for the enhanced metrics added in metrics_enhanced.py."""
        if df.empty:
            return

        fig, axes = plt.subplots(3, 2, figsize=(16, 13))
        fig.suptitle("Enhanced Running Metrics", fontsize=16, fontweight="bold")

        if "efficiency_factor" in df.columns:
            axes[0, 0].plot(df["date"], df["efficiency_factor"], marker="o")
            axes[0, 0].set_title("Efficiency Factor")
            axes[0, 0].set_ylabel("Speed / HR")
            axes[0, 0].tick_params(axis="x", rotation=45)
            axes[0, 0].grid(True, alpha=0.3)

        if "performance_index" in df.columns:
            axes[0, 1].plot(df["date"], df["performance_index"], marker="o")
            axes[0, 1].set_title("Performance Index")
            axes[0, 1].tick_params(axis="x", rotation=45)
            axes[0, 1].grid(True, alpha=0.3)

        if "aerobic_decoupling_pct" in df.columns:
            axes[1, 0].plot(df["date"], df["aerobic_decoupling_pct"], marker="o")
            axes[1, 0].axhline(5, linestyle=":", label="~5% caution")
            axes[1, 0].set_title("Aerobic Decoupling / Cardiac Drift Proxy")
            axes[1, 0].set_ylabel("%")
            axes[1, 0].legend()
            axes[1, 0].tick_params(axis="x", rotation=45)
            axes[1, 0].grid(True, alpha=0.3)

        if "acwr_7_28" in df.columns:
            axes[1, 1].plot(df["date"], df["acwr_7_28"], marker="o")
            axes[1, 1].axhline(1.3, linestyle=":")
            axes[1, 1].axhline(0.8, linestyle=":")
            axes[1, 1].set_title("ACWR 7/28")
            axes[1, 1].tick_params(axis="x", rotation=45)
            axes[1, 1].grid(True, alpha=0.3)

        if "weekly_monotony" in df.columns:
            axes[2, 0].plot(df["date"], df["weekly_monotony"], marker="o")
            axes[2, 0].axhline(2.0, linestyle=":")
            axes[2, 0].set_title("Weekly Monotony")
            axes[2, 0].tick_params(axis="x", rotation=45)
            axes[2, 0].grid(True, alpha=0.3)

        if "weekly_strain" in df.columns:
            axes[2, 1].plot(df["date"], df["weekly_strain"], marker="o")
            axes[2, 1].set_title("Weekly Strain")
            axes[2, 1].tick_params(axis="x", rotation=45)
            axes[2, 1].grid(True, alpha=0.3)

        plt.tight_layout()
        self._save_plot("enhanced_metrics.png")
        plt.show()

    def visualize_risk_dashboard(self, df: pd.DataFrame) -> None:
        """Create a risk-oriented plot with fatigue, overtraining and risk level."""
        if df.empty or "risk_level" not in df.columns:
            return

        plot_df = df.copy()
        risk_map = {"Low": 0, "Medium": 1, "High": 2}
        plot_df["risk_numeric"] = plot_df["risk_level"].map(risk_map).fillna(0)

        fig, axes = plt.subplots(2, 2, figsize=(16, 10))
        fig.suptitle("Fatigue and Overtraining Risk", fontsize=16, fontweight="bold")

        axes[0, 0].scatter(plot_df["date"], plot_df["risk_numeric"], s=80)
        axes[0, 0].set_yticks([0, 1, 2], ["Low", "Medium", "High"])
        axes[0, 0].set_title("Risk Level Over Time")
        axes[0, 0].tick_params(axis="x", rotation=45)
        axes[0, 0].grid(True, alpha=0.3)

        if "fatigue_index" in plot_df.columns:
            axes[0, 1].scatter(plot_df["date"], plot_df["fatigue_index"], s=80)
            axes[0, 1].set_title("Fatigue Index")
            axes[0, 1].tick_params(axis="x", rotation=45)
            axes[0, 1].grid(True, alpha=0.3)

        if "hr_rs_z" in plot_df.columns:
            axes[1, 0].plot(plot_df["date"], plot_df["hr_rs_z"], marker="o")
            axes[1, 0].axhline(1.5, linestyle=":")
            axes[1, 0].set_title("HR-RS Z-Score")
            axes[1, 0].tick_params(axis="x", rotation=45)
            axes[1, 0].grid(True, alpha=0.3)

        if {"recovery_score", "readiness_score"}.issubset(plot_df.columns):
            axes[1, 1].plot(plot_df["date"], plot_df["recovery_score"], marker="o", label="Recovery")
            axes[1, 1].plot(plot_df["date"], plot_df["readiness_score"], marker="s", label="Readiness")
            axes[1, 1].axhline(0.45, linestyle=":", label="Recovery caution")
            axes[1, 1].axhline(0.50, linestyle=":", label="Readiness caution")
            axes[1, 1].set_title("Recovery / Readiness Risk")
            axes[1, 1].legend()
            axes[1, 1].tick_params(axis="x", rotation=45)
            axes[1, 1].grid(True, alpha=0.3)

        plt.tight_layout()
        self._save_plot("risk_dashboard.png")
        plt.show()


    @staticmethod
    def _normalize_metric(series: pd.Series, higher_is_better: bool = True) -> pd.Series:
        series = pd.to_numeric(series, errors="coerce")
        min_val = series.min()
        max_val = series.max()
        range_val = max_val - min_val

        if pd.isna(range_val) or range_val == 0:
            normalized = pd.Series(0.5, index=series.index, dtype=float)
        else:
            normalized = (series - min_val) / range_val

        return normalized if higher_is_better else 1 - normalized