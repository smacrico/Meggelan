import pandas as pd
import streamlit as st
from sqlalchemy import text

from app.core.db import session_scope

st.title("HRV")

with session_scope() as session:
    hrv = pd.read_sql(
        text(
            '''
            SELECT metric_date, rmssd, sdnn, resting_hr, readiness_score, baseline_7d, baseline_28d
            FROM hrv_daily
            ORDER BY metric_date DESC
            LIMIT 120
            '''
        ),
        session.bind,
    )

if hrv.empty:
    st.info("No HRV data loaded.")
else:
    st.line_chart(hrv.set_index("metric_date")[["rmssd", "readiness_score"]])
    st.dataframe(hrv, use_container_width=True)
