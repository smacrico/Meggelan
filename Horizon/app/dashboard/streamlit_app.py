import streamlit as st

st.set_page_config(page_title="Garmin + HRV Analytics", layout="wide")

st.title("Garmin + HRV Analytics")
st.caption("Online dashboard for Garmin activity and HRV trends.")

st.write(
    '''
    Use the pages in the sidebar:

    - Overview
    - Activities
    - HRV
    - Pipeline Status
    '''
)
