
# Lipid Dashboard (Streamlit)

## Run
```bash
pip install streamlit pandas
streamlit run dashboard/app.py
```

## Features
- Reads `lipid_metrics` from SQLite
- KPI cards for latest lipid values
- Interactive trend charts
- Latest risk interpretation table
- Embedded exported plot images from your plot folder
- Data explorer with column selection and date filtering

## Default paths
- SQLite DB: `C:/smakrykodbs/hydra.db`
- Plot folder: `C:/temp/LogsFitnessApp/Lipid_Dashboard`

You can change both in the Streamlit sidebar.
