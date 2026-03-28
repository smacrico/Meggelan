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
        if df.empty or weekly_trimp.empty:
            return

        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        axes[0].plot(df["date"], df["TRIMP"], marker="o")
        axes[0].set_title("TRIMP per Session Over Time")
        axes[0].set_xlabel("Date")
        axes[0].set_ylabel("TRIMP Score")
        axes[0].tick_params(axis="x", rotation=45)

        weeks = weekly_trimp["week_label"]
        axes[1].plot(weeks, weekly_trimp["weekly_trimp"], label="Weekly TRIMP Load", marker="o")
        axes[1].plot(weeks, weekly_trimp["acute_load"], label="Acute Load (1 week)", linestyle="--")
        axes[1].plot(weeks, weekly_trimp["chronic_load"], label="Chronic Load (4 week avg)", linestyle="--")
        axes[1].plot(weeks, weekly_trimp["acwr"], label="ACWR", linestyle="-.")
        axes[1].axhline(1.3, color="red", linestyle=":", label="Upper ACWR Threshold (~1.3)")
        axes[1].axhline(0.8, color="green", linestyle=":", label="Lower ACWR Threshold (~0.8)")
        axes[1].set_title("Weekly Training Load and ACWR")
        axes[1].set_xlabel("ISO Week")
        axes[1].set_ylabel("Load / Ratio")
        axes[1].legend()
        axes[1].grid(True)
        axes[1].tick_params(axis="x", rotation=45)

        plt.tight_layout()
        self._save_plot("training_load.png")
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
