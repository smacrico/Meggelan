import pandas as pd
import streamlit as st
from sqlalchemy import text

from app.core.db import session_scope

st.title("Activities")

with session_scope() as session:
    activities = pd.read_sql(
        text(
            '''
            SELECT id, external_activity_id, activity_type, start_time_utc, duration_sec, distance_m, avg_hr, max_hr, training_load
            FROM activity
            ORDER BY start_time_utc DESC
            LIMIT 200
            '''
        ),
        session.bind,
    )

if activities.empty:
    st.info("No activities loaded.")
else:
    st.dataframe(activities, use_container_width=True)
