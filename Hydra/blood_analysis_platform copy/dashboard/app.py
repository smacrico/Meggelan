from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st


st.set_page_config(page_title="Blood Analysis Dashboard", layout="wide")


def load_config(config_path: str | Path) -> Dict[str, Any]:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def profile_plot_dir(config: Dict[str, Any], profile_name: str) -> Path:
    profile_cfg = config.get("profiles", {}).get(profile_name, {})
    return Path(profile_cfg.get("plot_dir", config["paths"]["plot_dir"]))


def get_database_path(config: Dict[str, Any]) -> str:
    return config["database"]["sqlite_path"]


def get_profile_config(config: Dict[str, Any], profile_name: str) -> Dict[str, Any]:
    return config.get("profiles", {}).get(profile_name, {})


def table_exists(db_path: str, table_name: str) -> bool:
    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


@st.cache_data(show_spinner=False)
def load_table(db_path: str, table_name: str) -> pd.DataFrame:
    conn = sqlite3.connect(db_path)
    try:
        return pd.read_sql_query(f'SELECT * FROM "{table_name}"', conn)
    finally:
        conn.close()


def normalize_date_column(df: pd.DataFrame) -> pd.DataFrame:
    candidates = ["exam_date", "Exam Date", "date", "Date"]
    out = df.copy()
    for c in candidates:
        if c in out.columns:
            out["__date__"] = pd.to_datetime(out[c], errors="coerce")
            return out
    out["__date__"] = pd.NaT
    return out


def latest_row(df: pd.DataFrame) -> pd.Series:
    if df.empty:
        return pd.Series(dtype="object")
    dfx = normalize_date_column(df).sort_values("__date__")
    return dfx.iloc[-1]


def safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or pd.isna(value):
            return None
        return float(value)
    except Exception:
        return None


def human_value(value: Any, decimals: int = 2) -> str:
    v = safe_float(value)
    if v is None:
        return "N/A"
    return f"{v:.{decimals}f}"


def show_metric_card(label: str, value: Any, delta: Any = None) -> None:
    delta_str = None
    if delta is not None and not pd.isna(delta):
        try:
            delta_str = f"{float(delta):+.2f}"
        except Exception:
            delta_str = str(delta)
    st.metric(label, human_value(value), delta_str)


def show_risk_fields(row: pd.Series, fields: List[str]) -> None:
    cols = st.columns(max(1, min(4, len(fields))))
    i = 0
    for field in fields:
        if field in row.index:
            with cols[i % len(cols)]:
                st.caption(field)
                st.write(str(row.get(field, "N/A")))
            i += 1


def line_chart_section(df: pd.DataFrame, metrics: List[str], title: str, key: str) -> None:
    st.subheader(title)
    if df.empty:
        st.info("No data available.")
        return

    dfx = normalize_date_column(df).dropna(subset=["__date__"]).sort_values("__date__")
    existing = [m for m in metrics if m in dfx.columns]
    if not existing:
        st.info("No compatible metric columns found.")
        return

    selected = st.multiselect(
        "Select metrics",
        options=existing,
        default=existing[: min(3, len(existing))],
        key=key,
    )
    if not selected:
        return

    chart_df = dfx.set_index("__date__")[selected]
    st.line_chart(chart_df, use_container_width=True)


def show_exported_plots(plot_dir: Path, title: str) -> None:
    st.subheader(title)
    if not plot_dir.exists():
        st.info(f"Plot folder not found: {plot_dir}")
        return

    files = sorted(plot_dir.glob("*.png"))
    if not files:
        st.info("No exported plots found.")
        return

    for file in files:
        st.image(str(file), caption=file.name, use_container_width=True)


def render_data_explorer(df: pd.DataFrame, title: str) -> None:
    st.subheader(title)
    if df.empty:
        st.info("No data available.")
        return

    with st.expander("Filter columns", expanded=False):
        selected = st.multiselect(
            "Columns",
            options=list(df.columns),
            default=list(df.columns[: min(15, len(df.columns))]),
            key=f"cols_{title}",
        )

    st.dataframe(df[selected] if selected else df, use_container_width=True)


def render_lipid_tab(df: pd.DataFrame, plot_dir: Path) -> None:
    st.header("Lipidemic Profile")
    if df.empty:
        st.warning("No lipid data found.")
        return

    row = latest_row(df)
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        show_metric_card("Total Cholesterol", row.get("total_cholesterol"), row.get("total_cholesterol_delta"))
        show_metric_card("HDL", row.get("hdl"), row.get("hdl_delta"))
    with c2:
        show_metric_card("LDL Final", row.get("ldl_final"), row.get("ldl_final_delta"))
        show_metric_card("Triglycerides", row.get("triglycerides"), row.get("triglycerides_delta"))
    with c3:
        show_metric_card("Non-HDL", row.get("non_hdl_final"), row.get("non_hdl_final_delta"))
        show_metric_card("Remnant Cholesterol", row.get("remnant_cholesterol"), row.get("remnant_cholesterol_delta"))
    with c4:
        show_metric_card("TC/HDL Ratio", row.get("tc_hdl_ratio"), row.get("tc_hdl_ratio_delta"))
        show_metric_card("TG/HDL Ratio", row.get("tg_hdl_ratio"), row.get("tg_hdl_ratio_delta"))

    st.subheader("Latest Interpretations")
    show_risk_fields(
        row,
        [
            "tg_status",
            "non_hdl_risk",
            "tc_hdl_risk",
            "ldl_hdl_risk",
            "tg_hdl_risk",
            "aip_risk",
            "remnant_risk",
            "record_quality_note",
            "ldl_method",
        ],
    )

    line_chart_section(
        df,
        [
            "total_cholesterol",
            "hdl",
            "ldl_final",
            "triglycerides",
            "non_hdl_final",
            "tc_hdl_ratio",
            "ldl_hdl_ratio",
            "tg_hdl_ratio",
            "aip",
            "remnant_cholesterol",
            "lpa",
        ],
        "Interactive Trends",
        "lipid_trends",
    )

    show_exported_plots(plot_dir, "Exported Lipid Plots")
    render_data_explorer(df, "Lipid Data Explorer")


def render_endo_tab(df: pd.DataFrame, plot_dir: Path) -> None:
    st.header("Endocrinology Profile")
    if df.empty:
        st.warning("No endocrinology data found.")
        return

    row = latest_row(df)
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        show_metric_card("Glucose for Calc", row.get("glucose_for_calc"), row.get("glucose_for_calc_delta"))
        show_metric_card("Fasting Insulin", row.get("fasting_insulin"), row.get("fasting_insulin_delta"))
    with c2:
        show_metric_card("HbA1c", row.get("hba1c"), row.get("hba1c_delta"))
        show_metric_card("eAG", row.get("eag_mgdl"), row.get("eag_mgdl_delta"))
    with c3:
        show_metric_card("HOMA-IR", row.get("homa_ir"), row.get("homa_ir_delta"))
        show_metric_card("QUICKI", row.get("quicki"), row.get("quicki_delta"))
    with c4:
        show_metric_card("TSH", row.get("tsh"), row.get("tsh_delta"))
        show_metric_card("TSH / Free T4", row.get("tsh_free_t4_ratio"), row.get("tsh_free_t4_ratio_delta"))

    st.subheader("Latest Interpretations")
    show_risk_fields(
        row,
        [
            "homa_ir_interpretation",
            "vitamin_d_status",
            "record_quality_note",
        ],
    )

    line_chart_section(
        df,
        [
            "glucose_for_calc",
            "fasting_insulin",
            "hba1c",
            "eag_mgdl",
            "homa_ir",
            "quicki",
            "tsh",
            "free_t4",
            "tsh_free_t4_ratio",
            "vitamin_d_25_oh",
        ],
        "Interactive Trends",
        "endo_trends",
    )

    show_exported_plots(plot_dir, "Exported Endocrinology Plots")
    render_data_explorer(df, "Endocrinology Data Explorer")


def render_placeholder_tab(title: str) -> None:
    st.header(title)
    st.info("This profile is configured in the dashboard, but its pipeline/table is not active yet.")


st.title("Blood Analysis Dashboard")

base_dir = Path(__file__).resolve().parents[1]
default_config_path = base_dir / "config" / "config.json"

with st.sidebar:
    st.header("Configuration")
    config_path = st.text_input("Config path", value=str(default_config_path))

try:
    config = load_config(config_path)
    db_path = get_database_path(config)
except Exception as e:
    st.error(f"Failed to load config: {e}")
    st.stop()

with st.sidebar:
    st.success("Config loaded")
    st.caption(f"SQLite DB: {db_path}")

profiles_cfg = config.get("profiles", {})

tabs = []
tab_defs = []

if profiles_cfg.get("lipidemic", {}).get("enabled", False):
    tabs.append("Lipid")
    tab_defs.append("lipidemic")

if profiles_cfg.get("endocrinology", {}).get("enabled", False):
    tabs.append("Endocrinology")
    tab_defs.append("endocrinology")

if profiles_cfg.get("cbc", {}).get("enabled", False):
    tabs.append("CBC")
    tab_defs.append("cbc")

if profiles_cfg.get("liver", {}).get("enabled", False):
    tabs.append("Liver")
    tab_defs.append("liver")

if not tabs:
    st.error("No enabled profiles found in config.")
    st.stop()

streamlit_tabs = st.tabs(tabs)

for tab, profile_name in zip(streamlit_tabs, tab_defs):
    with tab:
        profile_cfg = get_profile_config(config, profile_name)
        target_table = profile_cfg.get("target_table")
        plot_dir = profile_plot_dir(config, profile_name)

        if not target_table or not table_exists(db_path, target_table):
            st.warning(f"Table not found for profile '{profile_name}': {target_table}")
            continue

        df = load_table(db_path, target_table)

        if profile_name == "lipidemic":
            render_lipid_tab(df, plot_dir)
        elif profile_name == "endocrinology":
            render_endo_tab(df, plot_dir)
        elif profile_name == "cbc":
            render_placeholder_tab("CBC / Hematology Profile")
        elif profile_name == "liver":
            render_placeholder_tab("Liver Profile")