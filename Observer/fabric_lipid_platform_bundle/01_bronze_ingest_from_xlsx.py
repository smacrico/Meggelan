# Fabric Notebook: 01_bronze_ingest_from_xlsx
# Default Lakehouse: lh_bronze_health

from datetime import datetime, timezone
import json
import re
import uuid

try:
    from notebookutils import mssparkutils
except Exception:
    mssparkutils = None

import pandas as pd
from pyspark.sql import functions as F

source_file_path = mssparkutils.notebook.getArgument("source_file_path", "/lakehouse/default/Files/blood_tests/lipids/raw/Lipid_Derived_Markers_Trends_March2026.xlsx") if mssparkutils else "/lakehouse/default/Files/blood_tests/lipids/raw/Lipid_Derived_Markers_Trends_March2026.xlsx"
source_file_name = source_file_path.rstrip("/").split("/")[-1]
ingest_run_id = mssparkutils.notebook.getArgument("ingest_run_id", str(uuid.uuid4())) if mssparkutils else str(uuid.uuid4())
ingest_ts = datetime.now(timezone.utc).isoformat()

local_file = f"/tmp/{source_file_name}"
if mssparkutils and not source_file_path.startswith("/lakehouse/"):
    mssparkutils.fs.cp(source_file_path, f"file:{local_file}", True)
    excel_path = local_file
else:
    excel_path = source_file_path

sheet_config = {
    "Raw_Lipid_Data": {"header": 2, "target": "brz_lipid_raw_lipid_data"},
    "Derived_Markers": {"header": 2, "target": "brz_lipid_derived_markers"},
    "Improved_or_Worsened": {"header": 2, "target": "brz_lipid_trend_changes"},
    "Summary": {"header": None, "target": "brz_lipid_summary_kv"}
}

def normalize_name(value):
    value = str(value).strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "unnamed_column"

def dataframe_from_sheet(sheet_name, cfg):
    if cfg["header"] is None:
        pdf = pd.read_excel(excel_path, sheet_name=sheet_name, header=None, engine="openpyxl")
        pdf = pdf.dropna(how="all")
        pdf.columns = [f"column_{i+1}" for i in range(len(pdf.columns))]
    else:
        pdf = pd.read_excel(excel_path, sheet_name=sheet_name, header=cfg["header"], engine="openpyxl")
        pdf = pdf.dropna(how="all")
        pdf.columns = [normalize_name(c) for c in pdf.columns]
    pdf = pdf.astype("string").where(pd.notnull(pdf), None)
    pdf["source_sheet"] = sheet_name
    pdf["source_file_name"] = source_file_name
    pdf["source_file_path"] = source_file_path
    pdf["ingest_run_id"] = ingest_run_id
    pdf["ingest_ts_utc"] = ingest_ts
    return spark.createDataFrame(pdf)

for sheet_name, cfg in sheet_config.items():
    df = dataframe_from_sheet(sheet_name, cfg)
    df.write.format("delta").mode("append").option("mergeSchema", "true").saveAsTable(cfg["target"])

manifest = spark.createDataFrame([{
    "ingest_run_id": ingest_run_id,
    "source_file_name": source_file_name,
    "source_file_path": source_file_path,
    "ingest_ts_utc": ingest_ts,
    "sheet_count": len(sheet_config),
    "bronze_tables": json.dumps([cfg["target"] for cfg in sheet_config.values()])
}])
manifest.write.format("delta").mode("append").saveAsTable("brz_file_manifest")
