# Fabric Notebook: 02_silver_transform
# Purpose:
#   Read Bronze lipid workbook tables from lh_bronze by OneLake path.
#   Clean, type, conform, deduplicate, and write Silver Delta tables to lh_silver.
#
# IMPORTANT:
#   Attach this notebook to lh_silver and pin lh_silver as the default Lakehouse.
#   This notebook intentionally stops if the default Lakehouse is not lh_silver.

# COMMAND ----------
# PARAMETERS CELL
# In Microsoft Fabric, mark this first cell as "parameters".
# Pipeline Notebook activity base parameters can override these values.

workspace_name_or_id = "<YOUR_WORKSPACE_ID_OR_NAME>"

bronze_lakehouse_name = "lh_bronze_health"
silver_lakehouse_name = "lh_silver_health"

# Leave blank for standard Lakehouses. Use "dbo" or your schema name if Lakehouse schemas are enabled.
bronze_schema_name = ""

bronze_raw_table_name = "brz_lipid_raw_lipid_data"
silver_panel_table_name = "silver_lipid_panel"
silver_quality_table_name = "silver_lipid_quality_issues"

patient_key = "SELF_OR_UNKNOWN"

# Supported:
# - "overwrite": rebuild the Silver tables
# - "append": append to the Silver tables
silver_write_mode = "overwrite"

# Set to False only while debugging notebookutils/lakehouse metadata issues.
enforce_default_lakehouse = True

# COMMAND ----------
# IMPORTS

import re
from pyspark.sql import functions as F
from pyspark.sql import Window
from pyspark.sql.types import StringType

# Spark 3+ has stricter datetime parsing. Use CORRECTED rather than LEGACY,
# and parse source date strings explicitly below.
spark.conf.set("spark.sql.legacy.timeParserPolicy", "CORRECTED")


# COMMAND ----------
# NOTEBOOK / LAKEHOUSE HELPERS

def _load_notebookutils():
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


def _object_get(obj, key):
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def get_current_default_lakehouse_name():
    """
    Best-effort detection of the currently pinned/default Lakehouse.
    Different Fabric runtimes may return lakehouse metadata differently.
    """
    candidates = []

    for utils_obj in [notebookutils_ref, mssparkutils_ref]:
        try:
            lakehouse_obj = getattr(utils_obj, "lakehouse", None)
            if lakehouse_obj is not None and hasattr(lakehouse_obj, "get"):
                current = lakehouse_obj.get()
                candidates.append(current)
        except Exception:
            pass

    for current in candidates:
        for key in ["displayName", "name", "lakehouseName"]:
            value = _object_get(current, key)
            if value:
                return str(value)

    return None


def assert_default_lakehouse(expected_lakehouse_name: str):
    current = get_current_default_lakehouse_name()

    if current is None:
        if enforce_default_lakehouse:
            raise RuntimeError(
                "Could not determine the default Lakehouse from notebookutils. "
                f"Please confirm this notebook is attached to and pinned to '{expected_lakehouse_name}'. "
                "Then either rerun, or temporarily set enforce_default_lakehouse = False."
            )
        else:
            print(
                "WARNING: Could not determine the default Lakehouse. "
                "Continuing because enforce_default_lakehouse = False."
            )
            return

    print(f"Current default Lakehouse: {current}")

    if current.lower() != expected_lakehouse_name.lower():
        raise RuntimeError(
            f"Wrong default Lakehouse. Expected '{expected_lakehouse_name}', "
            f"but current default is '{current}'. "
            f"Move the notebook pin icon to '{expected_lakehouse_name}' before running."
        )



def quote_identifier_part(value: str) -> str:
    return "`" + str(value).replace("`", "``") + "`"


def lakehouse_table_identifier(lakehouse_name: str, table_name: str, schema_name: str = "") -> str:
    """
    Returns a Spark SQL identifier for a Fabric Lakehouse table.

    Non-schema Lakehouse:
        `lakehouse`.`table`

    Schema-enabled Lakehouse:
        `lakehouse`.`schema`.`table`
    """
    lakehouse_name = str(lakehouse_name).strip()
    table_name = str(table_name).strip()
    schema_name = str(schema_name or "").strip()

    if schema_name:
        return (
            f"{quote_identifier_part(lakehouse_name)}."
            f"{quote_identifier_part(schema_name)}."
            f"{quote_identifier_part(table_name)}"
        )

    return f"{quote_identifier_part(lakehouse_name)}.{quote_identifier_part(table_name)}"


def read_fabric_lakehouse_table(lakehouse_name: str, table_name: str, schema_name: str = ""):
    """
    Reads a table through Fabric Spark catalog resolution instead of manually building
    an abfss:// path. This avoids 400 Bad Request errors caused by mixing workspace
    IDs, display names, item IDs, and .Lakehouse suffixes incorrectly.
    """
    attempts = []

    if str(schema_name or "").strip():
        attempts.append(lakehouse_table_identifier(lakehouse_name, table_name, schema_name))

    attempts.append(lakehouse_table_identifier(lakehouse_name, table_name, ""))

    errors = []
    for identifier in attempts:
        try:
            print(f"Trying Spark catalog read: {identifier}")
            df = spark.table(identifier)
            print(f"Successfully read: {identifier}")
            return df
        except Exception as exc:
            errors.append(f"{identifier} -> {type(exc).__name__}: {str(exc)[:500]}")

    raise RuntimeError(
        "Could not read the Lakehouse table through the Spark catalog. "
        "Make sure the source Lakehouse is in the same workspace or attached to the notebook, "
        "and confirm whether Lakehouse schemas are enabled. Attempts:\n"
        + "\n".join(errors)
    )


def make_onelake_table_root(workspace_value: str, lakehouse_name: str) -> str:
    workspace_value = str(workspace_value).strip()
    lakehouse_name = str(lakehouse_name).strip()

    if not workspace_value or workspace_value.startswith("<"):
        raise ValueError(
            "Parameter workspace_name_or_id still has a placeholder value. "
            "Set it to your Fabric workspace name or workspace ID."
        )

    if not lakehouse_name:
        raise ValueError("Lakehouse name cannot be blank.")

    return (
        f"abfss://{workspace_value}@onelake.dfs.fabric.microsoft.com/"
        f"{lakehouse_name}.Lakehouse/Tables"
    )


def table_path(table_root: str, table_name: str) -> str:
    return f"{table_root.rstrip('/')}/{table_name}"


def spark_table_exists(table_name: str) -> bool:
    try:
        return spark.catalog.tableExists(table_name)
    except Exception:
        try:
            spark.sql(f"DESCRIBE TABLE `{table_name}`")
            return True
        except Exception:
            return False


# COMMAND ----------
# VALIDATE CONFIGURATION

workspace_name_or_id = str(workspace_name_or_id).strip()
bronze_lakehouse_name = str(bronze_lakehouse_name).strip()
silver_lakehouse_name = str(silver_lakehouse_name).strip()
bronze_raw_table_name = str(bronze_raw_table_name).strip()
silver_panel_table_name = str(silver_panel_table_name).strip()
silver_quality_table_name = str(silver_quality_table_name).strip()
patient_key = str(patient_key).strip() or "SELF_OR_UNKNOWN"
silver_write_mode = str(silver_write_mode).strip().lower()

if silver_write_mode not in {"overwrite", "append"}:
    raise ValueError("silver_write_mode must be either 'overwrite' or 'append'.")

assert_default_lakehouse(silver_lakehouse_name)

print("Silver notebook configuration")
print(f"  workspace_name_or_id       : {workspace_name_or_id}")
print(f"  bronze_lakehouse_name      : {bronze_lakehouse_name}")
print(f"  bronze_schema_name         : {bronze_schema_name if bronze_schema_name else '<none>'}")
print(f"  silver_lakehouse_name      : {silver_lakehouse_name}")
print(f"  bronze_raw_table_name      : {bronze_raw_table_name}")
print(f"  silver_panel_table_name    : {silver_panel_table_name}")
print(f"  silver_quality_table_name  : {silver_quality_table_name}")
print(f"  silver_write_mode          : {silver_write_mode}")
print("  cross-lakehouse read mode  : Spark catalog, not manual ABFSS path")


# COMMAND ----------
# COLUMN HELPERS

def normalize_lookup_name(name: str) -> str:
    value = str(name).strip().lower()
    value = value.replace("%", " percent ")
    value = value.replace("+/-", " plus_minus ")
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value


def first_existing_column(df, candidates, required=True, label=None):
    existing = {c.lower(): c for c in df.columns}

    for candidate in candidates:
        normalized = normalize_lookup_name(candidate)
        if normalized.lower() in existing:
            return existing[normalized.lower()]
        if str(candidate).lower() in existing:
            return existing[str(candidate).lower()]

    if required:
        raise ValueError(
            f"Could not find required column '{label or candidates[0]}'. "
            f"Tried candidates: {candidates}. Available columns: {df.columns}"
        )

    return None


def col_or_null(df, candidates, label=None):
    col_name = first_existing_column(df, candidates, required=False, label=label)
    if col_name is None:
        return F.lit(None).cast("string")
    return F.col(col_name).cast("string")


def to_double_expr(column_expr):
    """
    Converts Bronze strings to doubles.
    Handles blanks, comma decimal separators, and simple unit text.
    """
    raw = F.trim(column_expr.cast("string"))

    cleaned = F.regexp_replace(raw, ",", ".")
    cleaned = F.regexp_replace(cleaned, r"[^0-9\.\-]", "")

    return (
        F.when(raw.isNull() | (raw == "") | (F.lower(raw).isin("nan", "none", "null")), None)
         .when(cleaned == "", None)
         .otherwise(cleaned.cast("double"))
    )


def parse_date_expr(column_expr):
    """
    Robust Spark 3+ date parser.

    Spark 3+ is strict when a pattern does not consume the full string.
    Example: to_date('2025-09-23T00:00:00', 'yyyy-MM-dd') can fail because
    the 'T00:00:00' part remains unparsed.

    Supported inputs:
    - 2025-09-23
    - 2025-09-23T00:00:00
    - 2025-09-23 00:00:00
    - 23/09/2025
    - 9/23/2025
    - Excel serial dates
    """
    raw = F.trim(column_expr.cast("string"))

    is_blank = (
        raw.isNull()
        | (raw == "")
        | F.lower(raw).isin("nan", "none", "null", "nat")
    )

    # ISO-like values. Only parse the first 10 characters as yyyy-MM-dd,
    # so timestamp suffixes such as T00:00:00 do not break Spark's parser.
    iso_date = F.when(
        raw.rlike(r"^\d{4}-\d{2}-\d{2}([T\s].*)?$"),
        F.to_date(F.substring(raw, 1, 10), "yyyy-MM-dd")
    )

    # European-style lab dates: dd/MM/yyyy or d/M/yyyy.
    dmy_date = F.when(
        raw.rlike(r"^\d{1,2}/\d{1,2}/\d{4}$"),
        F.coalesce(
            F.to_date(raw, "dd/MM/yyyy"),
            F.to_date(raw, "d/M/yyyy")
        )
    )

    # US-style dates with dashes: MM-dd-yyyy or M-d-yyyy.
    mdy_dash_date = F.when(
        raw.rlike(r"^\d{1,2}-\d{1,2}-\d{4}$"),
        F.coalesce(
            F.to_date(raw, "MM-dd-yyyy"),
            F.to_date(raw, "M-d-yyyy")
        )
    )

    # Excel serial date. Excel's 1900 date system maps well with 1899-12-30.
    excel_serial_date = F.when(
        raw.rlike(r"^[0-9]+(\.0+)?$"),
        F.date_add(F.to_date(F.lit("1899-12-30")), raw.cast("double").cast("int"))
    )

    return F.when(is_blank, F.lit(None).cast("date")).otherwise(
        F.coalesce(
            iso_date,
            dmy_date,
            mdy_dash_date,
            excel_serial_date
        )
    )

def safe_divide(numerator, denominator):
    return F.when(
        numerator.isNotNull() & denominator.isNotNull() & (denominator != 0),
        numerator / denominator
    )


# COMMAND ----------
# READ BRONZE TABLE THROUGH FABRIC SPARK CATALOG
#
# This intentionally avoids manually built abfss:// paths. Manual paths are easy
# to break by mixing workspace IDs with Lakehouse display names, or by adding
# .Lakehouse when an item ID path is required.

bronze_raw = read_fabric_lakehouse_table(
    lakehouse_name=bronze_lakehouse_name,
    table_name=bronze_raw_table_name,
    schema_name=bronze_schema_name
)

print(f"Read Bronze rows: {bronze_raw.count()}")
print("Bronze columns:")
print(bronze_raw.columns)


# COMMAND ----------
# MAP BRONZE COLUMNS TO CANONICAL SILVER FIELDS

exam_date_col = first_existing_column(
    bronze_raw,
    ["exam_date", "date", "test_date", "measurement_date"],
    label="Exam Date"
)

total_cholesterol_col = first_existing_column(
    bronze_raw,
    ["total_cholesterol", "total_cholesterol_mg_dl", "cholesterol_total", "tc"],
    label="Total Cholesterol"
)

hdl_col = first_existing_column(
    bronze_raw,
    ["hdl", "hdl_cholesterol", "hdl_mg_dl"],
    label="HDL"
)

ldl_col = first_existing_column(
    bronze_raw,
    ["ldl", "ldl_cholesterol", "ldl_mg_dl"],
    label="LDL"
)

triglycerides_col = first_existing_column(
    bronze_raw,
    ["triglycerides", "triglyceride", "tg", "triglycerides_mg_dl"],
    label="Triglycerides"
)

reported_non_hdl_col = first_existing_column(
    bronze_raw,
    ["reported_non_hdl", "non_hdl", "non_hdl_cholesterol", "reported_non_hdl_mg_dl"],
    required=False,
    label="Reported Non-HDL"
)

lpa_col = first_existing_column(
    bronze_raw,
    ["lp_a", "lpa", "lipoprotein_a", "lipoprotein_a_lp_a"],
    required=False,
    label="Lp(a)"
)

print("Column mapping")
print(f"  exam_date           <- {exam_date_col}")
print(f"  total_cholesterol   <- {total_cholesterol_col}")
print(f"  hdl                 <- {hdl_col}")
print(f"  ldl                 <- {ldl_col}")
print(f"  triglycerides       <- {triglycerides_col}")
print(f"  reported_non_hdl    <- {reported_non_hdl_col}")
print(f"  lpa                 <- {lpa_col}")


# COMMAND ----------
# BUILD CLEANSED SILVER LIPID PANEL

source_row_number_col = "source_row_number" if "source_row_number" in bronze_raw.columns else None
source_row_hash_col = "source_row_hash" if "source_row_hash" in bronze_raw.columns else None
source_system_col = "source_system" if "source_system" in bronze_raw.columns else None
data_domain_col = "data_domain" if "data_domain" in bronze_raw.columns else None
source_sheet_col = "source_sheet" if "source_sheet" in bronze_raw.columns else None
source_file_name_col = "source_file_name" if "source_file_name" in bronze_raw.columns else None
source_file_path_col = "source_file_path" if "source_file_path" in bronze_raw.columns else None
source_file_id_col = "source_file_id" if "source_file_id" in bronze_raw.columns else None
ingest_run_id_col = "ingest_run_id" if "ingest_run_id" in bronze_raw.columns else None
ingest_ts_utc_col = "ingest_ts_utc" if "ingest_ts_utc" in bronze_raw.columns else None

base = (
    bronze_raw
    .withColumn("patient_key", F.lit(patient_key))
    .withColumn("exam_date", parse_date_expr(F.col(exam_date_col)))
    .withColumn("total_cholesterol_mg_dl", to_double_expr(F.col(total_cholesterol_col)))
    .withColumn("hdl_mg_dl", to_double_expr(F.col(hdl_col)))
    .withColumn("ldl_mg_dl", to_double_expr(F.col(ldl_col)))
    .withColumn("triglycerides_mg_dl", to_double_expr(F.col(triglycerides_col)))
    .withColumn(
        "reported_non_hdl_mg_dl",
        to_double_expr(F.col(reported_non_hdl_col)) if reported_non_hdl_col else F.lit(None).cast("double")
    )
    .withColumn(
        "lpa_mg_dl",
        to_double_expr(F.col(lpa_col)) if lpa_col else F.lit(None).cast("double")
    )
    .withColumn(
        "source_row_number",
        F.col(source_row_number_col).cast("long") if source_row_number_col else F.lit(None).cast("long")
    )
    .withColumn(
        "source_row_hash",
        F.col(source_row_hash_col).cast("string") if source_row_hash_col else F.sha2(
            F.concat_ws(
                "||",
                F.coalesce(F.col(exam_date_col).cast("string"), F.lit("")),
                F.coalesce(F.col(total_cholesterol_col).cast("string"), F.lit("")),
                F.coalesce(F.col(hdl_col).cast("string"), F.lit("")),
                F.coalesce(F.col(ldl_col).cast("string"), F.lit("")),
                F.coalesce(F.col(triglycerides_col).cast("string"), F.lit(""))
            ),
            256
        )
    )
    .withColumn("source_system", F.col(source_system_col).cast("string") if source_system_col else F.lit("unknown"))
    .withColumn("data_domain", F.col(data_domain_col).cast("string") if data_domain_col else F.lit("health_lipids"))
    .withColumn("source_sheet", F.col(source_sheet_col).cast("string") if source_sheet_col else F.lit("Raw_Lipid_Data"))
    .withColumn("source_file_name", F.col(source_file_name_col).cast("string") if source_file_name_col else F.lit(None).cast("string"))
    .withColumn("source_file_path", F.col(source_file_path_col).cast("string") if source_file_path_col else F.lit(None).cast("string"))
    .withColumn("source_file_id", F.col(source_file_id_col).cast("string") if source_file_id_col else F.lit(None).cast("string"))
    .withColumn("ingest_run_id", F.col(ingest_run_id_col).cast("string") if ingest_run_id_col else F.lit(None).cast("string"))
    .withColumn("bronze_ingest_ts_utc", F.col(ingest_ts_utc_col).cast("string") if ingest_ts_utc_col else F.lit(None).cast("string"))
)

silver = (
    base
    .withColumn(
        "calculated_non_hdl_mg_dl",
        F.when(
            F.col("total_cholesterol_mg_dl").isNotNull() & F.col("hdl_mg_dl").isNotNull(),
            F.col("total_cholesterol_mg_dl") - F.col("hdl_mg_dl")
        )
    )
    .withColumn(
        "non_hdl_mg_dl",
        F.coalesce(F.col("reported_non_hdl_mg_dl"), F.col("calculated_non_hdl_mg_dl"))
    )
    .withColumn(
        "tc_hdl_ratio",
        safe_divide(F.col("total_cholesterol_mg_dl"), F.col("hdl_mg_dl"))
    )
    .withColumn(
        "ldl_hdl_ratio",
        safe_divide(F.col("ldl_mg_dl"), F.col("hdl_mg_dl"))
    )
    .withColumn(
        "tg_hdl_ratio",
        safe_divide(F.col("triglycerides_mg_dl"), F.col("hdl_mg_dl"))
    )
    .withColumn(
        "aip",
        F.when(
            F.col("tg_hdl_ratio").isNotNull() & (F.col("tg_hdl_ratio") > 0),
            F.log10(F.col("tg_hdl_ratio"))
        )
    )
    .withColumn(
        "remnant_cholesterol_mg_dl",
        F.when(
            F.col("total_cholesterol_mg_dl").isNotNull()
            & F.col("ldl_mg_dl").isNotNull()
            & F.col("hdl_mg_dl").isNotNull(),
            F.col("total_cholesterol_mg_dl") - F.col("ldl_mg_dl") - F.col("hdl_mg_dl")
        )
    )
    .withColumn(
        "is_complete_basic_panel",
        F.col("exam_date").isNotNull()
        & F.col("total_cholesterol_mg_dl").isNotNull()
        & F.col("hdl_mg_dl").isNotNull()
        & F.col("ldl_mg_dl").isNotNull()
        & F.col("triglycerides_mg_dl").isNotNull()
    )
    .withColumn(
        "has_negative_remnant_cholesterol",
        F.coalesce(F.col("remnant_cholesterol_mg_dl") < 0, F.lit(False))
    )
    .withColumn(
        "aip_risk_band",
        F.when(F.col("aip").isNull(), None)
         .when(F.col("aip") < 0.11, "Low")
         .when(F.col("aip") <= 0.21, "Intermediate")
         .otherwise("High")
    )
    .withColumn(
        "tg_hdl_risk_band",
        F.when(F.col("tg_hdl_ratio").isNull(), None)
         .when(F.col("tg_hdl_ratio") < 2.0, "Good")
         .when(F.col("tg_hdl_ratio") <= 3.0, "Borderline")
         .otherwise("Elevated")
    )
    .withColumn(
        "data_quality_status",
        F.when(F.col("exam_date").isNull(), "REJECT_DATE")
         .when(~F.col("is_complete_basic_panel"), "PARTIAL_PANEL")
         .when(F.col("has_negative_remnant_cholesterol"), "CHECK_DERIVED_METRIC")
         .otherwise("VALID")
    )
    .withColumn("silver_load_ts_utc", F.current_timestamp())
)

# Deduplicate repeated runs / repeated source rows.
dedup_window = (
    Window
    .partitionBy("patient_key", "exam_date", "source_row_hash")
    .orderBy(F.col("silver_load_ts_utc").desc())
)

silver_deduped = (
    silver
    .withColumn("dedupe_rank", F.row_number().over(dedup_window))
    .where(F.col("dedupe_rank") == 1)
    .drop("dedupe_rank")
)

# Add trend fields after deduplication.
trend_window = Window.partitionBy("patient_key").orderBy("exam_date")

silver_final = (
    silver_deduped
    .withColumn("previous_exam_date", F.lag("exam_date").over(trend_window))
    .withColumn("previous_total_cholesterol_mg_dl", F.lag("total_cholesterol_mg_dl").over(trend_window))
    .withColumn("previous_hdl_mg_dl", F.lag("hdl_mg_dl").over(trend_window))
    .withColumn("previous_ldl_mg_dl", F.lag("ldl_mg_dl").over(trend_window))
    .withColumn("previous_triglycerides_mg_dl", F.lag("triglycerides_mg_dl").over(trend_window))
    .withColumn("previous_non_hdl_mg_dl", F.lag("non_hdl_mg_dl").over(trend_window))
    .withColumn("ldl_change_mg_dl", F.col("ldl_mg_dl") - F.col("previous_ldl_mg_dl"))
    .withColumn("hdl_change_mg_dl", F.col("hdl_mg_dl") - F.col("previous_hdl_mg_dl"))
    .withColumn("triglycerides_change_mg_dl", F.col("triglycerides_mg_dl") - F.col("previous_triglycerides_mg_dl"))
    .withColumn("non_hdl_change_mg_dl", F.col("non_hdl_mg_dl") - F.col("previous_non_hdl_mg_dl"))
    .select(
        "patient_key",
        "exam_date",
        "previous_exam_date",
        "total_cholesterol_mg_dl",
        "hdl_mg_dl",
        "ldl_mg_dl",
        "triglycerides_mg_dl",
        "reported_non_hdl_mg_dl",
        "calculated_non_hdl_mg_dl",
        "non_hdl_mg_dl",
        "lpa_mg_dl",
        "tc_hdl_ratio",
        "ldl_hdl_ratio",
        "tg_hdl_ratio",
        "aip",
        "remnant_cholesterol_mg_dl",
        "aip_risk_band",
        "tg_hdl_risk_band",
        "previous_total_cholesterol_mg_dl",
        "previous_hdl_mg_dl",
        "previous_ldl_mg_dl",
        "previous_triglycerides_mg_dl",
        "previous_non_hdl_mg_dl",
        "ldl_change_mg_dl",
        "hdl_change_mg_dl",
        "triglycerides_change_mg_dl",
        "non_hdl_change_mg_dl",
        "is_complete_basic_panel",
        "has_negative_remnant_cholesterol",
        "data_quality_status",
        "source_system",
        "data_domain",
        "source_sheet",
        "source_file_name",
        "source_file_path",
        "source_file_id",
        "source_row_number",
        "source_row_hash",
        "ingest_run_id",
        "bronze_ingest_ts_utc",
        "silver_load_ts_utc"
    )
)


# COMMAND ----------
# BUILD SILVER QUALITY ISSUES TABLE

quality_issues = (
    silver_final
    .select(
        "patient_key",
        "exam_date",
        "source_file_name",
        "source_row_number",
        "source_row_hash",
        "ingest_run_id",
        "data_quality_status",
        F.when(F.col("exam_date").isNull(), F.lit("Exam date could not be parsed."))
         .when(~F.col("is_complete_basic_panel"), F.lit("Basic lipid panel is incomplete."))
         .when(F.col("has_negative_remnant_cholesterol"), F.lit("Calculated remnant cholesterol is negative."))
         .otherwise(F.lit(None)).alias("quality_issue_description"),
        "silver_load_ts_utc"
    )
    .where(F.col("data_quality_status") != "VALID")
)


# COMMAND ----------
# WRITE SILVER TABLES TO DEFAULT LAKEHOUSE, WHICH MUST BE lh_silver

writer_mode = "overwrite" if silver_write_mode == "overwrite" else "append"

(
    silver_final.write
    .format("delta")
    .mode(writer_mode)
    .option("overwriteSchema", "true" if writer_mode == "overwrite" else "false")
    .saveAsTable(silver_panel_table_name)
)

(
    quality_issues.write
    .format("delta")
    .mode(writer_mode)
    .option("overwriteSchema", "true" if writer_mode == "overwrite" else "false")
    .saveAsTable(silver_quality_table_name)
)

print(f"Wrote table: {silver_lakehouse_name}.{silver_panel_table_name}")
print(f"Wrote table: {silver_lakehouse_name}.{silver_quality_table_name}")


# COMMAND ----------
# VALIDATION

panel_count = spark.table(silver_panel_table_name).count()
quality_count = spark.table(silver_quality_table_name).count()

print("Silver validation")
print(f"  {silver_panel_table_name} rows   : {panel_count}")
print(f"  {silver_quality_table_name} rows : {quality_count}")

display(
    spark.table(silver_panel_table_name)
    .orderBy(F.col("exam_date").desc_nulls_last())
    .limit(20)
)

display(
    spark.table(silver_quality_table_name)
    .orderBy(F.col("exam_date").desc_nulls_last())
)
