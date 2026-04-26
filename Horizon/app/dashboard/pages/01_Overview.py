import pandas as pd
import streamlit as st
from sqlalchemy import text

from app.core.db import session_scope

st.title("Overview")

with session_scope() as session:
    summary = pd.read_sql(
        text(
            '''
            SELECT summary_date, total_distance_m, total_duration_sec, training_load, run_count, avg_hrv_rmssd, readiness_score
            FROM daily_summary
            ORDER BY summary_date DESC
            LIMIT 60
            '''
        ),
        session.bind,
    )

if summary.empty:
    st.info("No summary data available yet.")
else:
    st.metric("Days loaded", len(summary))
    st.line_chart(summary.set_index("summary_date")[["total_distance_m", "avg_hrv_rmssd", "readiness_score"]])
    st.dataframe(summary, use_container_width=True)
