from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
import streamlit as st


st.set_page_config(page_title="Blood Analysis Dashboard", layout="wide")


# ============================================================
# Config
# ============================================================

def load_config(config_path: str | Path = "config/config.json") -> Dict[str, Any]:
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_database_path(config: Dict[str, Any]) -> str:
    return config["database"]["sqlite_path"]


def get_plot_dir(config: Dict[str, Any]) -> str:
    return config["paths"]["plot_dir"]


def get_profile_config(config: Dict[str, Any], profile_name: str) -> Dict[str, Any]:
    return config.get("profiles", {}).get(profile_name, {})


# ============================================================
# Helpers
# ============================================================

def safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or pd.isna(value):
            return None
        return float(value)
    except Exception:
        return None


def human_value(value: Any, decimals: int = 2) -> str:
    num = safe_float(value)
    if num is None:
        return "N/A"
    return f"{num:.{decimals}f}"


def normalize_date_column(df: pd.DataFrame) -> pd.DataFrame:
    for candidate in ["exam_date", "Exam Date", "date", "Date"]:
        if candidate in df.columns:
            df = df.copy()
            df["__date__"] = pd.to_datetime(df[candidate], errors="coerce")
            return df
    df = df.copy()
    df["__date__"] = pd.NaT
    return df


def get_existing_columns(df: pd.DataFrame, columns: List[str]) -> List[str]:
    return [c for c in columns if c in df.columns]


def pick_first_existing(df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    for c in candidates:
        if c in df.columns:
            return c
    return None


@st.cache_data(show_spinner=False)
def load_table(db_path: str, table_name: str) -> pd.DataFrame:
    conn = sqlite3.connect(db_path)
    try:
        return pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
    finally:
        conn.close()


def table_exists(db_path: str, table_name: str) -> bool:
    conn = sqlite3.connect(db_path)
    try:
        q = """
        SELECT name
        FROM sqlite_master
        WHERE type='table' AND name=?
        """
        row = conn.execute(q, (table_name,)).fetchone()
        return row is not None
    finally:
        conn.close()


def latest_row(df: pd.DataFrame) -> pd.Series:
    if df.empty:
        return pd.Series(dtype="object")
    df2 = normalize_date_column(df).sort_values("__date__")
    return df2.iloc[-1]


def filter_by_date(df: pd.DataFrame, start_date: Optional[pd.Timestamp], end_date: Optional[pd.Timestamp]) -> pd.DataFrame:
    df2 = normalize_date_column(df)
    if start_date is not None:
        df2 = df2[df2["__date__"] >= pd.Timestamp(start_date)]
    if end_date is not None:
        df2 = df2[df2["__date__"] <= pd.Timestamp(end_date)]
    return df2


def show_metric_card(label: str, value: Any, delta: Any = None, decimals: int = 2) -> None:
    delta_str = None
    if delta is not None and not pd.isna(delta):
        try:
            delta_str = f"{float(delta):+.2f}"
        except Exception:
            delta_str = str(delta)
    st.metric(label=label, value=human_value(value, decimals=decimals), delta=delta_str)


def show_risk_fields(row: pd.Series, candidates: List[str]) -> None:
    cols = st.columns(max(1, min(4, len(candidates))))
    col_idx = 0
    for field in candidates:
        if field in row.index:
            with cols[col_idx % len(cols)]:
                st.caption(field)
                st.write(str(row.get(field, "N/A")))
            col_idx += 1


def list_plot_files(plot_dir: Path, profile_prefixes: List[str], preferred_keywords: Optional[List[str]] = None) -> List[Path]:
    if not plot_dir.exists():
        return []

    files = [p for p in plot_dir.glob("*.png") if p.is_file()]
    matched: List[Path] = []

    for file in files:
        lower = file.name.lower()
        prefix_hit = any(prefix.lower() in lower for prefix in profile_prefixes)
        keyword_hit = True if not preferred_keywords else any(k.lower() in lower for k in preferred_keywords)
        if prefix_hit or keyword_hit:
            matched.append(file)

    return sorted(set(matched), key=lambda p: p.name.lower())


def show_exported_plots(plot_dir: Path, title: str, profile_prefixes: List[str], preferred_keywords: Optional[List[str]] = None) -> None:
    st.subheader(title)
    files = list_plot_files(plot_dir, profile_prefixes, preferred_keywords)

    if not files:
        st.info("No exported plot images found for this section.")
        return

    for file in files:
        st.image(str(file), caption=file.name, use_container_width=True)


def render_data_explorer(df: pd.DataFrame, title: str) -> None:
    st.subheader(title)
    if df.empty:
        st.info("No data available.")
        return

    with st.expander("Filter columns", expanded=False):
        selected_cols = st.multiselect("Columns", options=list(df.columns), default=list(df.columns[: min(15, len(df.columns))]))
    if selected_cols:
        st.dataframe(df[selected_cols], use_container_width=True)
    else:
        st.dataframe(df, use_container_width=True)


def line_chart_section(df: pd.DataFrame, available_metrics: List[str], title: str) -> None:
    st.subheader(title)
    if df.empty:
        st.info("No data available.")
        return

    df2 = normalize_date_column(df).dropna(subset=["__date__"]).sort_values("__date__")
    metrics = get_existing_columns(df2, available_metrics)

    if not metrics:
        st.info("No compatible metric columns found.")
        return

    selected_metrics = st.multiselect(
        "Select metrics",
        options=metrics,
        default=metrics[: min(3, len(metrics))],
        key=f"metrics_{title}"
    )

    if not selected_metrics:
        st.warning("Select at least one metric.")
        return

    chart_df = df2.set_index("__date__")[selected_metrics]
    st.line_chart(chart_df, use_container_width=True)


# ============================================================
# Profile renderers
# ============================================================

def render_lipid_dashboard(df: pd.DataFrame, plot_dir: Path) -> None:
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
    )

    show_exported_plots(
        plot_dir=plot_dir,
        title="Exported Lipid Plots",
        profile_prefixes=["lipid", "cholesterol", "hdl", "ldl", "triglycerides", "aip", "remnant", "lpa"],
    )

    render_data_explorer(df, "Lipid Data Explorer")


def render_cbc_dashboard(df: pd.DataFrame, plot_dir: Path) -> None:
    st.header("CBC / Hematology Profile")

    if df.empty:
        st.warning("No CBC data found.")
        return

    row = latest_row(df)

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        show_metric_card("Hemoglobin", row.get("hemoglobin"))
        show_metric_card("WBC", row.get("wbc"))
    with c2:
        show_metric_card("RBC", row.get("rbc"))
        show_metric_card("Platelets", row.get("platelets"))
    with c3:
        show_metric_card("MCV", row.get("mcv"))
        show_metric_card("RDW", row.get("rdw"))
    with c4:
        show_metric_card("NLR", row.get("nlr"))
        show_metric_card("Mentzer Index", row.get("mentzer_index"))

    st.subheader("Latest Interpretations")
    show_risk_fields(
        row,
        [
            "record_quality_note",
            "nlr_risk",
            "mentzer_interpretation",
        ],
    )

    line_chart_section(
        df,
        [
            "hemoglobin",
            "wbc",
            "rbc",
            "platelets",
            "mcv",
            "rdw",
            "neutrophils",
            "lymphocytes",
            "nlr",
            "mentzer_index",
            "anc_surrogate",
            "alc_surrogate",
            "amc_surrogate",
        ],
        "Interactive Trends",
    )

    show_exported_plots(
        plot_dir=plot_dir,
        title="Exported CBC Plots",
        profile_prefixes=["cbc", "hematology", "wbc", "rbc", "platelet", "hemoglobin", "nlr"],
    )

    render_data_explorer(df, "CBC Data Explorer")


def render_liver_dashboard(df: pd.DataFrame, plot_dir: Path) -> None:
    st.header("Liver Profile")

    if df.empty:
        st.warning("No liver data found.")
        return

    row = latest_row(df)

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        show_metric_card("AST", row.get("ast"))
        show_metric_card("ALT", row.get("alt"))
    with c2:
        show_metric_card("AST/ALT Ratio", row.get("ast_alt_ratio"))
        show_metric_card("ALP", row.get("alp"))
    with c3:
        show_metric_card("Total Bilirubin", row.get("total_bilirubin"))
        show_metric_card("Direct Bilirubin", row.get("direct_bilirubin"))
    with c4:
        show_metric_card("Indirect Bilirubin", row.get("indirect_bilirubin"))
        show_metric_card("GGT", row.get("ggt"))

    st.subheader("Latest Interpretations")
    show_risk_fields(
        row,
        [
            "record_quality_note",
            "ast_alt_pattern",
            "bilirubin_pattern",
        ],
    )

    line_chart_section(
        df,
        [
            "ast",
            "alt",
            "ast_alt_ratio",
            "alp",
            "ggt",
            "total_bilirubin",
            "direct_bilirubin",
            "indirect_bilirubin",
            "direct_total_bilirubin_pct",
            "albumin",
            "total_protein",
        ],
        "Interactive Trends",
    )

    show_exported_plots(
        plot_dir=plot_dir,
        title="Exported Liver Plots",
        profile_prefixes=["liver", "ast", "alt", "bilirubin", "alp", "ggt"],
    )

    render_data_explorer(df, "Liver Data Explorer")


# ============================================================
# Main app
# ============================================================

st.title("Blood Analysis Dashboard")

with st.sidebar:
    st.header("Configuration")
    config_path = st.sidebar.text_input(
    "Config path",
    value="../config/config.json"
)

try:
    config = load_config(config_path)
    db_path = get_database_path(config)
    plot_dir = Path(get_plot_dir(config))
except Exception as e:
    st.error(f"Failed to load config: {e}")
    st.stop()

with st.sidebar:
    st.success("Config loaded")
    st.caption(f"SQLite DB: {db_path}")
    st.caption(f"Plot directory: {plot_dir}")

    enabled_profiles = []
    all_profiles = config.get("profiles", {})
    for profile_name, profile_cfg in all_profiles.items():
        if profile_cfg.get("enabled", False):
            enabled_profiles.append(profile_name)

    if not enabled_profiles:
        st.error("No enabled profiles found in config.")
        st.stop()

    st.subheader("Enabled Profiles")
    st.write(", ".join(enabled_profiles))

# Load data for known profile names from config.
# Uses target_table from config; if missing, uses a fallback.
PROFILE_META: Dict[str, Dict[str, Any]] = {
    "lipidemic": {
        "label": "Lipid",
        "fallback_table": "lipid_metrics",
    },
    "cbc": {
        "label": "CBC",
        "fallback_table": "cbc_metrics",
    },
    "liver": {
        "label": "Liver",
        "fallback_table": "liver_metrics",
    },
}

loaded_data: Dict[str, pd.DataFrame] = {}
missing_tables: List[str] = []

for profile_key, meta in PROFILE_META.items():
    profile_cfg = get_profile_config(config, profile_key)
    if not profile_cfg.get("enabled", False):
        continue

    target_table = profile_cfg.get("target_table", meta["fallback_table"])
    if table_exists(db_path, target_table):
        try:
            loaded_data[profile_key] = load_table(db_path, target_table)
        except Exception as e:
            st.error(f"Failed loading {profile_key} from table '{target_table}': {e}")
            loaded_data[profile_key] = pd.DataFrame()
    else:
        missing_tables.append(target_table)
        loaded_data[profile_key] = pd.DataFrame()

# Global filters
st.subheader("Global Filters")

date_candidates: List[pd.Timestamp] = []
for df in loaded_data.values():
    if not df.empty:
        dfx = normalize_date_column(df)
        valid_dates = dfx["__date__"].dropna()
        if not valid_dates.empty:
            date_candidates.append(valid_dates.min())
            date_candidates.append(valid_dates.max())

if date_candidates:
    min_date = min(date_candidates).date()
    max_date = max(date_candidates).date()
    date_range = st.date_input("Date range", value=(min_date, max_date), min_value=min_date, max_value=max_date)
    if isinstance(date_range, tuple) and len(date_range) == 2:
        start_date, end_date = date_range
    else:
        start_date, end_date = min_date, max_date
else:
    start_date = None
    end_date = None
    st.info("No valid date fields found yet. Date filtering is disabled until data is available.")

for k, df in list(loaded_data.items()):
    loaded_data[k] = filter_by_date(df, start_date, end_date)

if missing_tables:
    st.warning(f"Missing tables: {', '.join(missing_tables)}")

# Tabs
tab_labels: List[str] = []
tab_keys: List[str] = []

for profile_key, meta in PROFILE_META.items():
    if profile_key in loaded_data:
        tab_labels.append(meta["label"])
        tab_keys.append(profile_key)

if not tab_labels:
    st.error("No profile tables are available to display.")
    st.stop()

tabs = st.tabs(tab_labels)

for tab, key in zip(tabs, tab_keys):
    with tab:
        df = loaded_data.get(key, pd.DataFrame())
        if key == "lipidemic":
            render_lipid_dashboard(df, plot_dir)
        elif key == "cbc":
            render_cbc_dashboard(df, plot_dir)
        elif key == "liver":
            render_liver_dashboard(df, plot_dir)