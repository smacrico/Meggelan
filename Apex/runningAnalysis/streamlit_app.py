from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from html_export import build_dashboard_html
from metrics import RunningMetricsService
from repository import RunningRepository


st.set_page_config(
    page_title="Running Performance Dashboard Pro",
    page_icon="🏃",
    layout="wide",
)

st.title("🏃 Running Performance Dashboard Pro")
st.caption("Interactive Plotly dashboard with HTML export, chart export, and anomaly detection.")


def pct_delta(current: float, baseline: float) -> str:
    if baseline == 0 or pd.isna(baseline):
        return "n/a"
    return f"{((current - baseline) / baseline) * 100:.1f}%"


def flatten_monthly(monthly: pd.DataFrame | None) -> pd.DataFrame:
    if monthly is None or monthly.empty:
        return pd.DataFrame()

    out = monthly.copy()
    out.columns = ["_".join([str(x) for x in col if str(x)]) for col in out.columns]
    out = out.reset_index()

    if "year_month" in out.columns:
        out["year_month"] = out["year_month"].astype(str)

    return out


def export_figure_assets(fig, output_dir: str | Path, base_name: str):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    html_path = output_dir / f"{base_name}.html"
    png_path = output_dir / f"{base_name}.png"

    fig.write_html(str(html_path), include_plotlyjs="cdn")

    try:
        fig.write_image(str(png_path), width=1400, height=800, scale=2)
        return html_path, png_path
    except Exception:
        return html_path, None


@st.cache_data(show_spinner=False)
def load_dashboard_data(db_path: str, rest_hr: int, max_hr: int):
    repo = RunningRepository(db_path=db_path)
    svc = RunningMetricsService(repository=repo, rest_hr=rest_hr, max_hr=max_hr)
    df, weekly = svc.load_training_log()

    if not df.empty:
        df = svc.calculate_recovery_and_readiness(df)
        session_scores = svc.calculate_session_scores(df)
        training_score = svc.calculate_training_score(df)
        monthly = svc.calculate_monthly_metrics_averages(df)
        df, anomaly_summary = svc.detect_anomalies(df, weekly)
    else:
        session_scores = pd.Series(dtype=float)
        training_score = None
        monthly = None
        anomaly_summary = {}

    return svc, df, weekly, session_scores, training_score, monthly, anomaly_summary


with st.sidebar:
    st.header("Settings")
    db_path = st.text_input("SQLite DB path", value="c:/smakrykoDBs/Apex.db")
    output_dir = st.text_input("Export folder", value="c:/temp/logsFitnessApp")
    rest_hr = st.number_input("Resting HR", min_value=30, max_value=120, value=60, step=1)
    max_hr = st.number_input("Max HR", min_value=100, max_value=240, value=190, step=1)

svc, df, weekly, session_scores, training_score, monthly, anomaly_summary = load_dashboard_data(
    db_path=db_path,
    rest_hr=int(rest_hr),
    max_hr=int(max_hr),
)

if df.empty:
    st.warning("No running sessions found in the database.")
    st.stop()

min_date = df["date"].min().date()
max_date = df["date"].max().date()

with st.sidebar:
    st.header("Filters")
    date_range = st.date_input(
        "Date range",
        value=(min_date, max_date),
        min_value=min_date,
        max_value=max_date,
    )

if isinstance(date_range, tuple) and len(date_range) == 2:
    start_date = pd.to_datetime(date_range[0]).normalize()
    end_date = pd.to_datetime(date_range[1]).normalize() + pd.Timedelta(days=1) - pd.Timedelta(microseconds=1)
else:
    start_date = pd.to_datetime(min_date).normalize()
    end_date = pd.to_datetime(max_date).normalize() + pd.Timedelta(days=1) - pd.Timedelta(microseconds=1)

filtered = df[(df["date"] >= start_date) & (df["date"] <= end_date)].copy()

with st.sidebar:
    speed_zones = sorted(filtered["speed_zone"].dropna().astype(str).unique().tolist())
    selected_zones = st.multiselect("Speed zones", options=speed_zones, default=speed_zones)

if selected_zones:
    filtered = filtered[filtered["speed_zone"].astype(str).isin(selected_zones)]

if filtered.empty:
    st.warning("No data available for the selected filters.")
    st.stop()

filtered_weekly = weekly[weekly["week_label"].isin(filtered["week_label"].unique())].copy()
filtered_scores = svc.calculate_session_scores(filtered)
filtered_training_score = svc.calculate_training_score(filtered)
filtered_monthly = svc.calculate_monthly_metrics_averages(filtered)
filtered, filtered_anomalies = svc.detect_anomalies(filtered, filtered_weekly)

latest = filtered.iloc[-1]
previous = filtered.iloc[-2] if len(filtered) > 1 else latest

k1, k2, k3, k4 = st.columns(4)
k1.metric("Sessions", f"{len(filtered)}")
k2.metric("Overall Score", f"{(filtered_training_score or {}).get('overall_score', 0):.1f}")
k3.metric("Average Speed", f"{filtered['avg_speed'].mean():.2f} km/h", pct_delta(filtered['avg_speed'].mean(), df['avg_speed'].mean()))
k4.metric("Average TRIMP", f"{filtered['TRIMP'].mean():.1f}", pct_delta(filtered['TRIMP'].mean(), df['TRIMP'].mean()))

k5, k6, k7, k8 = st.columns(4)
k5.metric("Latest Pace", f"{latest['pace_per_km']:.2f} min/km")
k6.metric("Latest Recovery", f"{latest['recovery_score']:.2f}", pct_delta(latest['recovery_score'], previous['recovery_score']))
k7.metric("Latest Readiness", f"{latest['readiness_score']:.2f}", pct_delta(latest['readiness_score'], previous['readiness_score']))
k8.metric("Latest Risk", str(latest["risk_level"]))

if filtered_anomalies.get("high_risk_latest"):
    st.error("High overtraining risk detected in the latest session.")
elif filtered_anomalies.get("medium_risk_latest"):
    st.warning("Medium fatigue risk detected in the latest session.")
else:
    st.success("Latest session risk is low.")

tabs = st.tabs([
    "Overview",
    "Training Load",
    "Speed & Pace",
    "Recovery",
    "HR-RS & Anomalies",
    "Data & Export",
])

figures = {}

with tabs[0]:
    fig_session = go.Figure()
    fig_session.add_trace(go.Scatter(x=filtered["date"], y=filtered_scores, mode="lines+markers", name="Session Score"))
    fig_session.add_trace(go.Scatter(x=filtered["date"], y=filtered["recovery_score"], mode="lines", name="Recovery"))
    fig_session.add_trace(go.Scatter(x=filtered["date"], y=filtered["readiness_score"], mode="lines", name="Readiness"))
    fig_session.update_layout(title="Session Score vs Recovery / Readiness", height=420)
    st.plotly_chart(fig_session, use_container_width=True)
    figures["Session Score vs Recovery / Readiness"] = fig_session

    metric_choice = st.selectbox(
        "Metric Explorer",
        [
            "running_economy",
            "vo2max",
            "distance",
            "efficiency_score",
            "heart_rate",
            "avg_speed",
            "pace_per_km",
            "speed_efficiency",
            "economy_at_speed",
        ],
        index=5,
    )
    fig_metric = px.line(filtered, x="date", y=metric_choice, markers=True, title=metric_choice.replace("_", " ").title())
    st.plotly_chart(fig_metric, use_container_width=True)
    figures[f"Metric Explorer - {metric_choice}"] = fig_metric

with tabs[1]:
    c1, c2 = st.columns(2)

    with c1:
        fig_trimp = px.line(filtered, x="date", y="TRIMP", markers=True, title="TRIMP per Session")
        st.plotly_chart(fig_trimp, use_container_width=True)
        figures["TRIMP per Session"] = fig_trimp

    with c2:
        if not filtered_weekly.empty:
            fig_weekly = go.Figure()
            fig_weekly.add_trace(go.Scatter(x=filtered_weekly["week_label"], y=filtered_weekly["weekly_trimp"], mode="lines+markers", name="Weekly TRIMP"))
            fig_weekly.add_trace(go.Scatter(x=filtered_weekly["week_label"], y=filtered_weekly["acute_load"], mode="lines", name="Acute"))
            fig_weekly.add_trace(go.Scatter(x=filtered_weekly["week_label"], y=filtered_weekly["chronic_load"], mode="lines", name="Chronic"))
            fig_weekly.add_trace(go.Scatter(x=filtered_weekly["week_label"], y=filtered_weekly["acwr"], mode="lines", name="ACWR"))
            fig_weekly.add_hline(y=1.3, line_dash="dot")
            fig_weekly.add_hline(y=0.8, line_dash="dot")
            fig_weekly.update_layout(title="Weekly Load and ACWR", height=420)
            st.plotly_chart(fig_weekly, use_container_width=True)
            figures["Weekly Load and ACWR"] = fig_weekly

    monthly_flat = flatten_monthly(filtered_monthly)
    if not monthly_flat.empty and "TRIMP_mean" in monthly_flat.columns:
        fig_monthly_trimp = px.bar(monthly_flat, x="year_month", y="TRIMP_mean", title="Monthly Mean TRIMP")
        st.plotly_chart(fig_monthly_trimp, use_container_width=True)
        figures["Monthly Mean TRIMP"] = fig_monthly_trimp

with tabs[2]:
    c1, c2 = st.columns(2)

    with c1:
        fig_speed = go.Figure()
        fig_speed.add_trace(go.Scatter(x=filtered["date"], y=filtered["avg_speed"], mode="lines+markers", name="Avg Speed"))
        fig_speed.add_trace(go.Scatter(x=filtered["date"], y=filtered["max_speed"], mode="lines+markers", name="Max Speed"))
        fig_speed.update_layout(title="Speed Trends", height=420)
        st.plotly_chart(fig_speed, use_container_width=True)
        figures["Speed Trends"] = fig_speed

    with c2:
        fig_pace = px.line(filtered, x="date", y="pace_per_km", markers=True, title="Pace Trend")
        fig_pace.update_yaxes(autorange="reversed")
        st.plotly_chart(fig_pace, use_container_width=True)
        figures["Pace Trend"] = fig_pace

    c3, c4 = st.columns(2)
    with c3:
        fig_speed_hr = px.scatter(filtered, x="heart_rate", y="avg_speed", color="risk_level", hover_data=["date"], title="Speed vs Heart Rate")
        st.plotly_chart(fig_speed_hr, use_container_width=True)
        figures["Speed vs Heart Rate"] = fig_speed_hr

    with c4:
        zone_counts = filtered["speed_zone"].astype(str).value_counts().reset_index()
        zone_counts.columns = ["speed_zone", "sessions"]
        fig_zone = px.bar(zone_counts, x="speed_zone", y="sessions", title="Speed Zone Distribution")
        st.plotly_chart(fig_zone, use_container_width=True)
        figures["Speed Zone Distribution"] = fig_zone

with tabs[3]:
    fig_recovery = go.Figure()
    fig_recovery.add_trace(go.Scatter(x=filtered["date"], y=filtered["recovery_score"], mode="lines+markers", name="Recovery"))
    fig_recovery.add_trace(go.Scatter(x=filtered["date"], y=filtered["readiness_score"], mode="lines+markers", name="Readiness"))
    fig_recovery.add_hline(y=0.7, line_dash="dot")
    fig_recovery.update_layout(title="Recovery and Readiness", height=420)
    st.plotly_chart(fig_recovery, use_container_width=True)
    figures["Recovery and Readiness"] = fig_recovery

    c1, c2 = st.columns(2)
    with c1:
        fig_rec_hist = px.histogram(filtered, x="recovery_score", nbins=12, title="Recovery Distribution")
        st.plotly_chart(fig_rec_hist, use_container_width=True)
        figures["Recovery Distribution"] = fig_rec_hist
    with c2:
        fig_ready_hist = px.histogram(filtered, x="readiness_score", nbins=12, title="Readiness Distribution")
        st.plotly_chart(fig_ready_hist, use_container_width=True)
        figures["Readiness Distribution"] = fig_ready_hist

with tabs[4]:
    c1, c2 = st.columns(2)

    with c1:
        valid = filtered[filtered["hr_rs_deviation"] > 0]
        if not valid.empty:
            fig_hr_rs = px.line(valid, x="date", y="hr_rs_deviation", markers=True, color="risk_level", title="HR-RS Deviation Trend")
            st.plotly_chart(fig_hr_rs, use_container_width=True)
            figures["HR-RS Deviation Trend"] = fig_hr_rs

    with c2:
        valid = filtered[filtered["hr_rs_deviation"] > 0]
        if not valid.empty:
            fig_hr_rs_speed = px.scatter(valid, x="hr_rs_deviation", y="avg_speed", color="risk_level", hover_data=["date"], title="HR-RS vs Speed")
            st.plotly_chart(fig_hr_rs_speed, use_container_width=True)
            figures["HR-RS vs Speed"] = fig_hr_rs_speed

    c3, c4 = st.columns(2)
    with c3:
        fig_speed_eff = px.line(filtered, x="date", y="speed_efficiency", markers=True, color="risk_level", title="Speed Efficiency")
        st.plotly_chart(fig_speed_eff, use_container_width=True)
        figures["Speed Efficiency"] = fig_speed_eff
    with c4:
        fig_fatigue = px.scatter(filtered, x="date", y="fatigue_index", color="risk_level", size="TRIMP", title="Fatigue Index Monitor")
        st.plotly_chart(fig_fatigue, use_container_width=True)
        figures["Fatigue Index Monitor"] = fig_fatigue

    st.subheader("Anomaly Flags")
    anomaly_view = filtered[[
        "date", "avg_speed", "TRIMP", "recovery_score", "readiness_score",
        "hr_rs_deviation", "fatigue_index", "acwr", "risk_level",
        "fatigue_flag", "overtraining_flag"
    ]].sort_values("date", ascending=False)
    st.dataframe(anomaly_view, use_container_width=True)

with tabs[5]:
    st.subheader("Training Score Breakdown")
    breakdown_df = pd.DataFrame(filtered_training_score["metric_breakdown"]).T if filtered_training_score else pd.DataFrame()
    st.dataframe(breakdown_df, use_container_width=True)

    st.subheader("Monthly Summary")
    monthly_flat = flatten_monthly(filtered_monthly)
    st.dataframe(monthly_flat, use_container_width=True)

    st.subheader("Filtered Raw Data")
    st.dataframe(filtered, use_container_width=True)

    export_col1, export_col2, export_col3 = st.columns(3)

    with export_col1:
        if st.button("Export Full HTML Dashboard"):
            kpis = {
                "Sessions": len(filtered),
                "Overall Score": f"{(filtered_training_score or {}).get('overall_score', 0):.1f}",
                "Average Speed": f"{filtered['avg_speed'].mean():.2f} km/h",
                "Average TRIMP": f"{filtered['TRIMP'].mean():.1f}",
                "Latest Risk": str(latest["risk_level"]),
                "Fatigue Flags": int(filtered["fatigue_flag"].sum()),
                "Overtraining Flags": int(filtered["overtraining_flag"].sum()),
            }
            tables = {
                "Training Score Breakdown": breakdown_df.reset_index().rename(columns={"index": "metric"}),
                "Monthly Summary": monthly_flat,
                "Anomaly Flags": anomaly_view,
            }
            notes = [
                f"Filtered date range: {start_date.date()} to {end_date.date()}",
                f"Selected speed zones: {', '.join(selected_zones) if selected_zones else 'All'}",
            ]
            html_path = build_dashboard_html(
                output_dir=output_dir,
                title="Running Performance Dashboard Export",
                kpis=kpis,
                figures=figures,
                tables=tables,
                notes=notes,
            )
            st.success(f"Saved HTML dashboard: {html_path}")

    with export_col2:
        chart_name = st.selectbox("Chart to export", list(figures.keys()))
        if st.button("Export Selected Chart as HTML + PNG"):
            base_name = chart_name.lower().replace(" ", "_").replace("/", "_")
            html_path, png_path = export_figure_assets(figures[chart_name], output_dir=output_dir, base_name=base_name)
            if png_path:
                st.success(f"Saved chart assets: {html_path} and {png_path}")
            else:
                st.warning(f"Saved HTML chart: {html_path}. PNG export needs kaleido.")

    with export_col3:
        st.download_button(
            "Download filtered CSV",
            data=filtered.to_csv(index=False).encode("utf-8"),
            file_name="running_dashboard_filtered.csv",
            mime="text/csv",
        )