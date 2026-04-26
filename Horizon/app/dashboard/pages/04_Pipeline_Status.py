import pandas as pd
import streamlit as st
from sqlalchemy import text

from app.core.db import session_scope

st.title("Pipeline Status")

with session_scope() as session:
    runs = pd.read_sql(
        text(
            '''
            SELECT id, job_name, started_at, finished_at, status, rows_inserted, rows_updated, error_message
            FROM job_run
            ORDER BY started_at DESC
            LIMIT 50
            '''
        ),
        session.bind,
    )
    batches = pd.read_sql(
        text(
            '''
            SELECT id, source_type, source_file_name, imported_at, status, error_message
            FROM import_batch
            ORDER BY imported_at DESC
            LIMIT 50
            '''
        ),
        session.bind,
    )

st.subheader("Job runs")
st.dataframe(runs, use_container_width=True)
st.subheader("Import batches")
st.dataframe(batches, use_container_width=True)
