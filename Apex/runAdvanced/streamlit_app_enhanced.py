from __future__ import annotations

from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from html_export_enhanced import build_dashboard_html
from metrics_enhanced import RunningMetricsService
from repository_enhanced import RunningRepository


st.set_page_config(
    page_title="Running Performance Dashboard Pro",
    page_icon="🏃",
    layout="wide",
)

st.title("🏃 Running Performance Dashboard Pro")
st.caption("Interactive Plotly dashboard with enhanced load, efficiency, recovery, risk, HTML export, chart export, and SQLite persistence.")


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

k9, k10, k11, k12 = st.columns(4)
k9.metric("Latest ACWR 7/28", f"{latest.get('acwr_7_28', latest.get('acwr', 0)):.2f}")
k10.metric("Latest Monotony", f"{latest.get('weekly_monotony', 0):.2f}")
k11.metric("Latest Strain", f"{latest.get('weekly_strain', 0):.1f}")
k12.metric("Latest EF", f"{latest.get('efficiency_factor', 0):.4f}")

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
    "Enhanced Metrics",
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
            "efficiency_factor",
            "performance_index",
            "aerobic_decoupling_pct",
            "acwr_7_28",
            "weekly_monotony",
            "weekly_strain",
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
            acute_col = "acute_load_7d" if "acute_load_7d" in filtered_weekly.columns else "acute_load"
            chronic_col = "chronic_load_28d" if "chronic_load_28d" in filtered_weekly.columns else "chronic_load"
            acwr_col = "acwr_7_28" if "acwr_7_28" in filtered_weekly.columns else "acwr"
            fig_weekly.add_trace(go.Scatter(x=filtered_weekly["week_label"], y=filtered_weekly[acute_col], mode="lines", name=acute_col))
            fig_weekly.add_trace(go.Scatter(x=filtered_weekly["week_label"], y=filtered_weekly[chronic_col], mode="lines", name=chronic_col))
            fig_weekly.add_trace(go.Scatter(x=filtered_weekly["week_label"], y=filtered_weekly[acwr_col], mode="lines", name=acwr_col))
            fig_weekly.add_hline(y=1.3, line_dash="dot")
            fig_weekly.add_hline(y=0.8, line_dash="dot")
            fig_weekly.update_layout(title="Weekly Load and Enhanced ACWR", height=420)
            st.plotly_chart(fig_weekly, use_container_width=True)
            figures["Weekly Load and ACWR"] = fig_weekly

    monthly_flat = flatten_monthly(filtered_monthly)
    if not monthly_flat.empty and "TRIMP_mean" in monthly_flat.columns:
        fig_monthly_trimp = px.bar(monthly_flat, x="year_month", y="TRIMP_mean", title="Monthly Mean TRIMP")
        st.plotly_chart(fig_monthly_trimp, use_container_width=True)
        figures["Monthly Mean TRIMP"] = fig_monthly_trimp

    c3, c4 = st.columns(2)
    with c3:
        load_cols = [col for col in ["acute_load_7d", "chronic_load_28d"] if col in filtered.columns]
        if load_cols:
            fig_loads = px.line(filtered, x="date", y=load_cols, markers=True, title="Calendar Acute / Chronic Loads")
            st.plotly_chart(fig_loads, use_container_width=True)
            figures["Calendar Acute Chronic Loads"] = fig_loads

    with c4:
        if {"weekly_monotony", "weekly_strain"}.issubset(filtered.columns):
            fig_strain = go.Figure()
            fig_strain.add_trace(go.Scatter(x=filtered["date"], y=filtered["weekly_monotony"], mode="lines+markers", name="Monotony"))
            fig_strain.add_trace(go.Scatter(x=filtered["date"], y=filtered["weekly_strain"], mode="lines+markers", name="Strain", yaxis="y2"))
            fig_strain.add_hline(y=2.0, line_dash="dot")
            fig_strain.update_layout(
                title="Training Monotony and Strain",
                yaxis=dict(title="Monotony"),
                yaxis2=dict(title="Strain", overlaying="y", side="right"),
                height=420,
            )
            st.plotly_chart(fig_strain, use_container_width=True)
            figures["Training Monotony and Strain"] = fig_strain

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
        enhanced_cols = [col for col in ["efficiency_factor", "performance_index", "speed_efficiency"] if col in filtered.columns]
        if enhanced_cols:
            fig_eff = px.line(filtered, x="date", y=enhanced_cols, markers=True, title="Efficiency and Performance Metrics")
            st.plotly_chart(fig_eff, use_container_width=True)
            figures["Efficiency and Performance Metrics"] = fig_eff

    with c2:
        if "aerobic_decoupling_pct" in filtered.columns:
            fig_decouple = px.line(filtered, x="date", y="aerobic_decoupling_pct", markers=True, color="risk_level", title="Aerobic Decoupling / Cardiac Drift Proxy")
            fig_decouple.add_hline(y=5, line_dash="dot")
            st.plotly_chart(fig_decouple, use_container_width=True)
            figures["Aerobic Decoupling"] = fig_decouple

    c3, c4 = st.columns(2)
    with c3:
        if "acwr_7_28" in filtered.columns:
            fig_acwr = px.line(filtered, x="date", y="acwr_7_28", markers=True, color="risk_level", title="ACWR 7/28")
            fig_acwr.add_hline(y=1.3, line_dash="dot")
            fig_acwr.add_hline(y=0.8, line_dash="dot")
            st.plotly_chart(fig_acwr, use_container_width=True)
            figures["ACWR 7/28"] = fig_acwr

    with c4:
        risk_counts = filtered["risk_level"].astype(str).value_counts().reset_index()
        risk_counts.columns = ["risk_level", "sessions"]
        fig_risk_counts = px.bar(risk_counts, x="risk_level", y="sessions", title="Risk Level Distribution")
        st.plotly_chart(fig_risk_counts, use_container_width=True)
        figures["Risk Level Distribution"] = fig_risk_counts

with tabs[5]:
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
        "hr_rs_deviation", "fatigue_index", "acwr", "acwr_7_28",
        "weekly_monotony", "weekly_strain", "risk_level",
        "fatigue_flag", "overtraining_flag"
    ]].sort_values("date", ascending=False)
    st.dataframe(anomaly_view, use_container_width=True)

with tabs[6]:
    st.subheader("Training Score Breakdown")
    breakdown_df = pd.DataFrame(filtered_training_score["metric_breakdown"]).T if filtered_training_score else pd.DataFrame()
    st.dataframe(breakdown_df, use_container_width=True)

    st.subheader("Monthly Summary")
    monthly_flat = flatten_monthly(filtered_monthly)
    st.dataframe(monthly_flat, use_container_width=True)

    st.subheader("Filtered Raw Data")
    st.dataframe(filtered, use_container_width=True)


    st.subheader("Persist Enhanced Outputs")
    if st.button("Save enhanced training log, monthly summaries, and metrics breakdown to SQLite"):
        repo = RunningRepository(db_path=db_path)
        repo.save_training_log(df)
        full_monthly = svc.calculate_monthly_metrics_averages(df)
        if full_monthly is not None and not full_monthly.empty:
            repo.upsert_monthly_summaries(full_monthly, svc.get_monthly_session_counts(df))
        full_training_score = svc.calculate_training_score(df)
        if full_training_score:
            repo.insert_metrics_breakdown(svc.build_metrics_breakdown_row(df, full_training_score))
        st.success("Saved enhanced outputs to adv_training_log, adv_monthly_summaries, and adv_metrics_breakdown.")

    export_col1, export_col2, export_col3 = st.columns(3)

    with export_col1:
        if st.button("Export Full HTML Dashboard"):
            kpis = {
                "Sessions": len(filtered),
                "Overall Score": f"{(filtered_training_score or {}).get('overall_score', 0):.1f}",
                "Average Speed": f"{filtered['avg_speed'].mean():.2f} km/h",
                "Average TRIMP": f"{filtered['TRIMP'].mean():.1f}",
                "Latest Risk": str(latest["risk_level"]),
                "Latest ACWR 7/28": f"{latest.get('acwr_7_28', latest.get('acwr', 0)):.2f}",
                "Latest Monotony": f"{latest.get('weekly_monotony', 0):.2f}",
                "Latest Strain": f"{latest.get('weekly_strain', 0):.1f}",
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