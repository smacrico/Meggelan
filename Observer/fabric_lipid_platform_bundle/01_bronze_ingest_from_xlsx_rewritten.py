# Fabric Notebook: 01_bronze_ingest_from_xlsx
# Purpose: Ingest the lipid Excel workbook into Bronze Delta tables.
# Attach this notebook to the Bronze Lakehouse, for example: lh_bronze_health.

# COMMAND ----------
# PARAMETERS CELL
# In Microsoft Fabric, mark this first cell as "parameters".
# Pipeline Notebook activity base parameters can override these values.

source_file_path = "/lakehouse/default/Files/blood_tests/lipids/raw/Lipid_Derived_Markers_Trends_March2026.xlsx"
ingest_run_id = ""

# Supported values:
# - "replace_run": delete rows for the same ingest_run_id, then append the current run
# - "append": append without deleting prior rows
# - "overwrite_table": overwrite each Bronze table
bronze_write_mode = "replace_run"

# Fail the notebook if an expected sheet is missing.
fail_on_missing_sheet = True

# Optional logical metadata.
source_system = "manual_excel_upload"
data_domain = "health_lipids"

# COMMAND ----------
# IMPORTS AND RUNTIME COMPATIBILITY

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile
import uuid

import pandas as pd
from pyspark.sql import functions as F
from pyspark.sql.types import StructType, StructField, StringType, LongType


def _load_notebookutils():
    """
    Fabric has used both notebookutils and mssparkutils names.
    This helper avoids AttributeError issues such as:
    mssparkutils.notebook.getArgument does not exist.
    """
    nbu = globals().get("notebookutils")
    msu = globals().get("mssparkutils")

    if nbu is None:
        try:
            import notebookutils as imported_notebookutils
            nbu = imported_notebookutils
        except Exception:
            nbu = None

    if msu is None:
        try:
            import mssparkutils as imported_mssparkutils
            msu = imported_mssparkutils
        except Exception:
            try:
                from notebookutils import mssparkutils as imported_mssparkutils
                msu = imported_mssparkutils
            except Exception:
                msu = None

    return nbu, msu


notebookutils_ref, mssparkutils_ref = _load_notebookutils()


def _get_fs_utils():
    if notebookutils_ref is not None and hasattr(notebookutils_ref, "fs"):
        return notebookutils_ref.fs
    if mssparkutils_ref is not None and hasattr(mssparkutils_ref, "fs"):
        return mssparkutils_ref.fs
    return None


fs_utils = _get_fs_utils()

# COMMAND ----------
# CONFIGURATION

DEFAULT_SOURCE_FILE_PATH = "/lakehouse/default/Files/blood_tests/lipids/raw/Lipid_Derived_Markers_Trends_March2026.xlsx"

source_file_path = str(globals().get("source_file_path", DEFAULT_SOURCE_FILE_PATH) or DEFAULT_SOURCE_FILE_PATH).strip()
ingest_run_id = str(globals().get("ingest_run_id", "") or "").strip()
bronze_write_mode = str(globals().get("bronze_write_mode", "replace_run") or "replace_run").strip().lower()
fail_on_missing_sheet = bool(globals().get("fail_on_missing_sheet", True))
source_system = str(globals().get("source_system", "manual_excel_upload") or "manual_excel_upload").strip()
data_domain = str(globals().get("data_domain", "health_lipids") or "health_lipids").strip()

if not ingest_run_id:
    ingest_run_id = str(uuid.uuid4())

if bronze_write_mode not in {"replace_run", "append", "overwrite_table"}:
    raise ValueError(
        "Invalid bronze_write_mode. Use one of: replace_run, append, overwrite_table."
    )

ingest_ts_utc = datetime.now(timezone.utc).isoformat()
source_file_name = source_file_path.rstrip("/").split("/")[-1]
source_file_extension = source_file_name.split(".")[-1].lower()

if source_file_extension not in {"xlsx", "xlsm", "xls"}:
    raise ValueError(
        f"Expected an Excel workbook path ending in .xlsx, .xlsm, or .xls. Got: {source_file_path}"
    )

SHEET_CONFIG = [
    {
        "sheet_name": "Raw_Lipid_Data",
        "target_table": "brz_lipid_raw_lipid_data",
        "header_row_zero_based": 2,
        "required": True,
        "description": "Raw lipid panel values as represented in the workbook."
    },
    {
        "sheet_name": "Derived_Markers",
        "target_table": "brz_lipid_derived_markers",
        "header_row_zero_based": 2,
        "required": True,
        "description": "Workbook-provided derived lipid metrics and ratios."
    },
    {
        "sheet_name": "Improved_or_Worsened",
        "target_table": "brz_lipid_trend_changes",
        "header_row_zero_based": 2,
        "required": True,
        "description": "Workbook-provided period-over-period trend comparison."
    },
    {
        "sheet_name": "Summary",
        "target_table": "brz_lipid_summary_kv",
        "header_row_zero_based": None,
        "required": False,
        "description": "Summary or key-value narrative content from workbook."
    }
]

AUDIT_TABLE = "brz_file_manifest"
SCHEMA_TABLE = "brz_excel_sheet_schema"
RUN_STATS_TABLE = "brz_ingestion_run_stats"

print("Bronze ingestion configuration")
print(f"  source_file_path   : {source_file_path}")
print(f"  source_file_name   : {source_file_name}")
print(f"  ingest_run_id      : {ingest_run_id}")
print(f"  bronze_write_mode  : {bronze_write_mode}")
print(f"  ingest_ts_utc      : {ingest_ts_utc}")

# COMMAND ----------
# UTILITY FUNCTIONS

def normalize_source_path(path_value: str) -> str:
    """
    Accepts common Fabric path styles and returns a usable path.

    Supported examples:
    - /lakehouse/default/Files/...
    - Files/...
    - file:/tmp/file.xlsx
    - abfss://workspace@onelake.dfs.fabric.microsoft.com/lakehouse.Lakehouse/Files/...
    """
    p = str(path_value).strip()

    if p.startswith("Files/"):
        return f"/lakehouse/default/{p}"

    if p.startswith("Tables/"):
        return f"/lakehouse/default/{p}"

    if p.startswith("file:/"):
        return p.replace("file:", "", 1)

    return p


def copy_remote_file_to_local_if_needed(path_value: str) -> str:
    """
    pandas/openpyxl can read local and mounted /lakehouse paths.
    For abfss or other remote paths, copy to local temp first using Fabric fs utilities.
    """
    normalized = normalize_source_path(path_value)

    if normalized.startswith("/lakehouse/") or normalized.startswith("/") and os.path.exists(normalized):
        return normalized

    if normalized.startswith("abfss://") or normalized.startswith("https://") or normalized.startswith("wasbs://"):
        if fs_utils is None:
            raise RuntimeError(
                "The source path is remote, but neither notebookutils.fs nor mssparkutils.fs is available "
                "to copy it locally. Use a /lakehouse/default/Files/... path or attach the Bronze Lakehouse."
            )

        local_dir = tempfile.mkdtemp(prefix="fabric_bronze_xlsx_")
        local_path = os.path.join(local_dir, normalized.rstrip("/").split("/")[-1])

        print(f"Copying remote workbook to local driver temp path: {local_path}")
        fs_utils.cp(normalized, f"file:{local_path}", True)
        return local_path

    if os.path.exists(normalized):
        return normalized

    raise FileNotFoundError(
        f"Workbook was not found or path is not readable by pandas/openpyxl: {path_value}. "
        "Recommended Fabric path: /lakehouse/default/Files/blood_tests/lipids/raw/<file>.xlsx"
    )


def normalize_column_name(value, ordinal: int) -> str:
    """
    Converts Excel headers into safe Bronze column names.
    """
    if value is None or str(value).strip() == "" or str(value).lower().startswith("unnamed:"):
        base = f"unnamed_column_{ordinal + 1}"
    else:
        base = str(value).strip().lower()

    base = base.replace("%", " percent ")
    base = base.replace("+/-", " plus_minus ")
    base = re.sub(r"[^a-z0-9]+", "_", base)
    base = re.sub(r"_+", "_", base).strip("_")
    return base or f"unnamed_column_{ordinal + 1}"


def make_unique_column_names(column_names):
    """
    Ensures duplicate Excel headers become deterministic unique names.
    Example: marker, marker -> marker, marker_2
    """
    seen = {}
    unique = []

    for col in column_names:
        count = seen.get(col, 0) + 1
        seen[col] = count
        unique.append(col if count == 1 else f"{col}_{count}")

    return unique


def bronze_string(value):
    """
    Bronze stores workbook cells as strings to preserve raw input safely.
    Type casting happens in Silver.
    """
    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if isinstance(value, pd.Timestamp):
        return value.isoformat()

    if hasattr(value, "isoformat") and value.__class__.__name__ in {"date", "datetime"}:
        return value.isoformat()

    return str(value).strip()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sql_identifier(identifier: str) -> str:
    """
    Quotes a Spark SQL identifier, supporting optional database.table input.
    """
    parts = str(identifier).split(".")
    return ".".join(f"`{p.replace('`', '``')}`" for p in parts)


def sql_string_literal(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def table_exists(table_name: str) -> bool:
    try:
        return spark.catalog.tableExists(table_name)
    except Exception:
        try:
            spark.sql(f"DESCRIBE TABLE {sql_identifier(table_name)}")
            return True
        except Exception:
            return False


def delete_existing_run(table_name: str, run_id: str):
    if table_exists(table_name):
        spark.sql(
            f"DELETE FROM {sql_identifier(table_name)} "
            f"WHERE ingest_run_id = {sql_string_literal(run_id)}"
        )


def write_delta(df, table_name: str, write_mode: str):
    if write_mode == "overwrite_table":
        (
            df.write
            .format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(table_name)
        )
    else:
        (
            df.write
            .format("delta")
            .mode("append")
            .option("mergeSchema", "true")
            .saveAsTable(table_name)
        )


def create_empty_spark_df(schema_fields):
    return spark.createDataFrame([], StructType(schema_fields))


# COMMAND ----------
# RESOLVE WORKBOOK PATH AND VALIDATE SHEETS

excel_path = copy_remote_file_to_local_if_needed(source_file_path)
print(f"Workbook path used by pandas/openpyxl: {excel_path}")

try:
    workbook = pd.ExcelFile(excel_path, engine="openpyxl")
except ImportError as exc:
    raise ImportError(
        "The Python package openpyxl is required to read .xlsx files. "
        "In Fabric, install it in the notebook environment if it is missing."
    ) from exc

available_sheets = workbook.sheet_names
expected_sheet_names = [cfg["sheet_name"] for cfg in SHEET_CONFIG]
missing_required_sheets = [
    cfg["sheet_name"]
    for cfg in SHEET_CONFIG
    if cfg["required"] and cfg["sheet_name"] not in available_sheets
]

print(f"Workbook sheets found: {available_sheets}")

if missing_required_sheets and fail_on_missing_sheet:
    raise ValueError(
        f"Missing required workbook sheets: {missing_required_sheets}. "
        f"Available sheets: {available_sheets}"
    )

# COMMAND ----------
# READ EXCEL SHEETS INTO PANDAS, NORMALIZE TO BRONZE SHAPE

def read_sheet_to_bronze_pandas(cfg: dict):
    sheet_name = cfg["sheet_name"]
    header_row = cfg["header_row_zero_based"]

    if sheet_name not in available_sheets:
        return None, [], 0

    if header_row is None:
        pdf = pd.read_excel(
            excel_path,
            sheet_name=sheet_name,
            header=None,
            dtype=object,
            engine="openpyxl"
        )
        pdf = pdf.dropna(axis=0, how="all").dropna(axis=1, how="all")

        original_columns = [f"column_{i + 1}" for i in range(len(pdf.columns))]
        bronze_columns = original_columns
        pdf.columns = bronze_columns
        source_row_numbers = [int(idx) + 1 for idx in pdf.index.tolist()]
    else:
        pdf = pd.read_excel(
            excel_path,
            sheet_name=sheet_name,
            header=header_row,
            dtype=object,
            engine="openpyxl"
        )
        pdf = pdf.dropna(axis=0, how="all").dropna(axis=1, how="all")

        original_columns = [str(c) for c in pdf.columns.tolist()]
        normalized = [
            normalize_column_name(c, i)
            for i, c in enumerate(original_columns)
        ]
        bronze_columns = make_unique_column_names(normalized)
        pdf.columns = bronze_columns

        # Excel rows are 1-based. If header is zero-based row 2, first data row is Excel row 4.
        source_row_numbers = [
            int(idx) + int(header_row) + 2
            for idx in pdf.index.tolist()
        ]

    # Convert business cells to strings only. Silver owns type casting.
    for col in bronze_columns:
        pdf[col] = pdf[col].map(bronze_string)

    # Drop rows that became fully empty after conversion.
    if bronze_columns:
        pdf = pdf.dropna(axis=0, how="all", subset=bronze_columns)

    # Recalculate row numbers after row filtering.
    if header_row is None:
        source_row_numbers = [int(idx) + 1 for idx in pdf.index.tolist()]
    else:
        source_row_numbers = [
            int(idx) + int(header_row) + 2
            for idx in pdf.index.tolist()
        ]

    pdf = pdf.reset_index(drop=True)

    workbook_file_id = sha256_text(f"{source_file_path}|{source_file_name}")
    pdf.insert(0, "source_row_number", source_row_numbers)
    pdf.insert(1, "source_row_hash", [
        sha256_text(
            json.dumps(
                {col: row.get(col) for col in bronze_columns},
                sort_keys=True,
                default=str
            )
        )
        for row in pdf.to_dict(orient="records")
    ])

    pdf["source_system"] = source_system
    pdf["data_domain"] = data_domain
    pdf["source_sheet"] = sheet_name
    pdf["source_file_name"] = source_file_name
    pdf["source_file_path"] = source_file_path
    pdf["source_file_id"] = workbook_file_id
    pdf["ingest_run_id"] = ingest_run_id
    pdf["ingest_ts_utc"] = ingest_ts_utc

    schema_rows = [
        {
            "ingest_run_id": ingest_run_id,
            "source_file_name": source_file_name,
            "source_sheet": sheet_name,
            "target_table": cfg["target_table"],
            "column_ordinal": ordinal + 1,
            "original_column_name": str(original_columns[ordinal]),
            "bronze_column_name": bronze_columns[ordinal],
            "ingest_ts_utc": ingest_ts_utc
        }
        for ordinal in range(len(bronze_columns))
    ]

    return pdf, schema_rows, len(pdf)


all_schema_rows = []
run_stats_rows = []
bronze_tables_written = []

# Remove same run first for idempotency.
if bronze_write_mode == "replace_run":
    for cfg in SHEET_CONFIG:
        delete_existing_run(cfg["target_table"], ingest_run_id)
    delete_existing_run(AUDIT_TABLE, ingest_run_id)
    delete_existing_run(SCHEMA_TABLE, ingest_run_id)
    delete_existing_run(RUN_STATS_TABLE, ingest_run_id)

for cfg in SHEET_CONFIG:
    sheet_name = cfg["sheet_name"]

    if sheet_name not in available_sheets:
        status = "MISSING_OPTIONAL" if not cfg["required"] else "MISSING_REQUIRED"
        run_stats_rows.append({
            "ingest_run_id": ingest_run_id,
            "source_sheet": sheet_name,
            "target_table": cfg["target_table"],
            "rows_written": 0,
            "status": status,
            "ingest_ts_utc": ingest_ts_utc
        })
        continue

    pdf, schema_rows, row_count = read_sheet_to_bronze_pandas(cfg)

    if pdf is None or row_count == 0:
        run_stats_rows.append({
            "ingest_run_id": ingest_run_id,
            "source_sheet": sheet_name,
            "target_table": cfg["target_table"],
            "rows_written": 0,
            "status": "EMPTY_SHEET",
            "ingest_ts_utc": ingest_ts_utc
        })
        continue

    sdf = spark.createDataFrame(pdf)
    write_delta(sdf, cfg["target_table"], bronze_write_mode)

    all_schema_rows.extend(schema_rows)
    bronze_tables_written.append(cfg["target_table"])

    run_stats_rows.append({
        "ingest_run_id": ingest_run_id,
        "source_sheet": sheet_name,
        "target_table": cfg["target_table"],
        "rows_written": int(row_count),
        "status": "WRITTEN",
        "ingest_ts_utc": ingest_ts_utc
    })

    print(f"Wrote {row_count} rows from sheet {sheet_name} to table {cfg['target_table']}")

# COMMAND ----------
# WRITE SCHEMA CAPTURE, RUN STATS, AND FILE MANIFEST

if all_schema_rows:
    schema_sdf = spark.createDataFrame(all_schema_rows)
else:
    schema_sdf = create_empty_spark_df([
        StructField("ingest_run_id", StringType(), True),
        StructField("source_file_name", StringType(), True),
        StructField("source_sheet", StringType(), True),
        StructField("target_table", StringType(), True),
        StructField("column_ordinal", LongType(), True),
        StructField("original_column_name", StringType(), True),
        StructField("bronze_column_name", StringType(), True),
        StructField("ingest_ts_utc", StringType(), True)
    ])

write_delta(schema_sdf, SCHEMA_TABLE, bronze_write_mode)

run_stats_sdf = spark.createDataFrame(run_stats_rows)
write_delta(run_stats_sdf, RUN_STATS_TABLE, bronze_write_mode)

manifest_row = [{
    "ingest_run_id": ingest_run_id,
    "source_system": source_system,
    "data_domain": data_domain,
    "source_file_name": source_file_name,
    "source_file_path": source_file_path,
    "source_file_id": sha256_text(f"{source_file_path}|{source_file_name}"),
    "ingest_ts_utc": ingest_ts_utc,
    "workbook_sheet_count": len(available_sheets),
    "available_sheets_json": json.dumps(available_sheets),
    "expected_sheets_json": json.dumps(expected_sheet_names),
    "bronze_tables_json": json.dumps(bronze_tables_written),
    "bronze_write_mode": bronze_write_mode,
    "status": "SUCCEEDED"
}]

manifest_sdf = spark.createDataFrame(manifest_row)
write_delta(manifest_sdf, AUDIT_TABLE, bronze_write_mode)

# COMMAND ----------
# POST-INGEST VALIDATION OUTPUT

validation_rows = []

for stat in run_stats_rows:
    table_name = stat["target_table"]
    sheet_name = stat["source_sheet"]

    if stat["status"] != "WRITTEN":
        validation_rows.append({
            "source_sheet": sheet_name,
            "target_table": table_name,
            "expected_rows_this_run": int(stat["rows_written"]),
            "actual_rows_this_run": 0,
            "validation_status": stat["status"]
        })
        continue

    actual_count = (
        spark.table(table_name)
        .where(F.col("ingest_run_id") == ingest_run_id)
        .count()
    )

    validation_rows.append({
        "source_sheet": sheet_name,
        "target_table": table_name,
        "expected_rows_this_run": int(stat["rows_written"]),
        "actual_rows_this_run": int(actual_count),
        "validation_status": "PASS" if int(actual_count) == int(stat["rows_written"]) else "FAIL"
    })

validation_sdf = spark.createDataFrame(validation_rows)

print("Bronze ingestion validation")
display(validation_sdf)

failed_count = validation_sdf.where(F.col("validation_status") == "FAIL").count()
if failed_count > 0:
    raise RuntimeError("Bronze ingestion validation failed. Check validation output above.")

print("Bronze ingestion completed successfully.")
print(f"ingest_run_id: {ingest_run_id}")
print(f"manifest table: {AUDIT_TABLE}")
print(f"schema table: {SCHEMA_TABLE}")
print(f"run stats table: {RUN_STATS_TABLE}")
