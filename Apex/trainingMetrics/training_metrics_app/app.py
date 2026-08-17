
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from training_metrics.core import (
    aggregate_daily,
    load_activities,
    load_pmc_forecast,
    race_readiness,
    running_analysis,
    workout_type_breakdown,
)


def save_training_trend(pmc: pd.DataFrame, out_dir: Path) -> Path:
    out = out_dir / "training_trend_ctl_atl_form.png"
    fig, ax = plt.subplots(figsize=(11, 6))
    ax.plot(pmc["date"], pmc["fitness_ctl"], label="Fitness (CTL)")
    ax.plot(pmc["date"], pmc["fatigue_atl"], label="Fatigue (ATL)")
    ax.plot(pmc["date"], pmc["form_tsb"], label="Form (TSB)")
    ax.set_title("Training Trend: CTL / ATL / Form")
    ax.set_xlabel("Date")
    ax.set_ylabel("Load")
    ax.legend()
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(out, dpi=160)
    plt.close(fig)
    return out


def save_workout_breakdown_chart(breakdown: pd.DataFrame, out_dir: Path) -> Path:
    out = out_dir / "workout_type_breakdown.png"
    fig, ax = plt.subplots(figsize=(10, 6))
    chart_df = breakdown.sort_values("total_load", ascending=True)
    ax.barh(chart_df["type"].astype(str), chart_df["total_load"])
    ax.set_title("Workout-Type Breakdown by Training Load")
    ax.set_xlabel("Total Training Load")
    fig.tight_layout()
    fig.savefig(out, dpi=160)
    plt.close(fig)
    return out


def save_running_analysis_chart(runs: pd.DataFrame, out_dir: Path) -> Path | None:
    if runs.empty or "pace_min_per_km" not in runs.columns:
        return None
    out = out_dir / "running_pace_hr_analysis.png"
    fig, ax1 = plt.subplots(figsize=(11, 6))
    ax1.plot(runs["start_date_local"], runs["pace_min_per_km"], marker="o", label="Pace min/km")
    ax1.invert_yaxis()
    ax1.set_ylabel("Pace min/km, lower is faster")
    ax1.set_xlabel("Date")
    if "average_heartrate" in runs.columns:
        ax2 = ax1.twinx()
        ax2.plot(runs["start_date_local"], runs["average_heartrate"], marker="x", label="Avg HR")
        ax2.set_ylabel("Average HR")
    ax1.set_title("Running Pace and Heart-Rate Analysis")
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(out, dpi=160)
    plt.close(fig)
    return out


def write_summary(readiness: dict, out_dir: Path) -> Path:
    out = out_dir / "race_readiness_assessment.md"
    text = f"""# Race-readiness assessment

As of: {readiness.get("as_of")}

Status: **{readiness.get("status")}**

Fitness (CTL): {readiness.get("fitness_ctl")}
Fatigue (ATL): {readiness.get("fatigue_atl")}
Form (TSB): {readiness.get("form_tsb")}

First date in readiness band (-5 to +10 TSB): {readiness.get("first_ready_date")}
Highest forecast CTL date: {readiness.get("highest_ctl_date")} ({readiness.get("highest_ctl")})

Assessment: {readiness.get("assessment")}
"""
    out.write_text(text)
    return out


def build_outputs(input_path: str, out_dir: str, use_forecast_sheet: bool = True) -> list[Path]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    activities = load_activities(input_path)
    daily = aggregate_daily(activities)
    try:
        pmc = load_pmc_forecast(input_path) if use_forecast_sheet else daily
        needed = {"date", "fitness_ctl", "fatigue_atl", "form_tsb"}
        if not needed.issubset(pmc.columns) or pmc[list(needed)].dropna().empty:
            pmc = daily
    except Exception:
        pmc = daily

    breakdown = workout_type_breakdown(activities)
    runs = running_analysis(activities)
    readiness = race_readiness(pmc)

    files = [
        save_training_trend(pmc, out),
        save_workout_breakdown_chart(breakdown, out),
        write_summary(readiness, out),
    ]
    run_chart = save_running_analysis_chart(runs, out)
    if run_chart:
        files.append(run_chart)

    daily.to_csv(out / "daily_metrics.csv", index=False)
    breakdown.to_csv(out / "workout_type_breakdown.csv", index=False)
    runs.to_csv(out / "running_pace_hr_analysis.csv", index=False)
    return files


def streamlit_app() -> None:
    import streamlit as st
    st.set_page_config(page_title="Training Metrics App", layout="wide")
    st.title("Training Metrics App")
    st.caption("Calculates CTL, ATL, Form, workout breakdowns, running pace/HR, and race readiness from Intervals.icu exports.")

    uploaded = st.file_uploader("Upload Intervals.icu activities CSV or workbook XLSX", type=["csv", "xlsx", "xlsm", "xls"])
    if not uploaded:
        st.info("Use the workbook sheet `intervals.icu_activities-export` or an Intervals.icu activities CSV export.")
        return

    tmp = Path("uploaded_training_data" + Path(uploaded.name).suffix)
    tmp.write_bytes(uploaded.getbuffer())

    activities = load_activities(tmp)
    daily = aggregate_daily(activities)
    try:
        pmc = load_pmc_forecast(tmp)
    except Exception:
        pmc = daily

    latest = daily.dropna(subset=["fitness_ctl", "fatigue_atl", "form_tsb"]).iloc[-1]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Fitness (CTL)", f"{latest.fitness_ctl:.1f}")
    c2.metric("Fatigue (ATL)", f"{latest.fatigue_atl:.1f}")
    c3.metric("Form (TSB)", f"{latest.form_tsb:.1f}")
    c4.metric("Daily Load", f"{latest.daily_load:.0f}")

    st.subheader("Training trend charts")
    st.line_chart(pmc.set_index("date")[["fitness_ctl", "fatigue_atl", "form_tsb"]])

    st.subheader("Workout-type breakdown")
    breakdown = workout_type_breakdown(activities)
    st.dataframe(breakdown, use_container_width=True)
    st.bar_chart(breakdown.set_index("type")["total_load"])

    st.subheader("Running pace and heart-rate analysis")
    runs = running_analysis(activities)
    st.dataframe(runs, use_container_width=True)
    if not runs.empty and {"start_date_local", "pace_min_per_km"}.issubset(runs.columns):
        st.line_chart(runs.set_index("start_date_local")[["pace_min_per_km", "average_heartrate"]].dropna(how="all"))

    st.subheader("Race-readiness assessment")
    st.json(race_readiness(pmc))


def main() -> None:
    parser = argparse.ArgumentParser(description="Produce training metrics from Intervals.icu exports.")
    parser.add_argument("input", help="Path to Intervals.icu activities CSV or workbook XLSX")
    parser.add_argument("--out", default="training_report", help="Output directory for charts and tables")
    parser.add_argument("--no-forecast-sheet", action="store_true", help="Ignore the workbook PMC forecast sheet and calculate only from activities")
    args = parser.parse_args()
    files = build_outputs(args.input, args.out, not args.no_forecast_sheet)
    print("Created:")
    for file in files:
        print(f" - {file}")


if __name__ == "__main__":
    main()
