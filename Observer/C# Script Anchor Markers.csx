// =======================================================
// Blood Analysis Platform - Trend + Anchor Marker Patch
// TE2-safe
//
// Adds:
//   1. Trend measures for charts
//   2. Anchor marker measures for selected/latest exam point
//
// Expected tables:
//   - Fact_LipidMetrics
//   - Fact_EndoMetrics
//   - Fact_LiverMetrics
//
// Requires existing anchor date measures from previous script:
//   - Lipid Anchor <Metric> Data Date
//   - Endo Anchor <Metric> Data Date
//   - Liver Anchor <Metric> Data Date
// =======================================================

using System;
using System.Linq;
using System.Collections.Generic;

string lipidTable = "Fact_LipidMetrics";
string endoTable  = "Fact_EndoMetrics";
string liverTable = "Fact_LiverMetrics";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
Measure GetMeasure(Table table, string measureName)
{
    return table.Measures.FirstOrDefault(x => x.Name == measureName);
}

void AddOrReplaceMeasure(string tableName, string measureName, string expression, string displayFolder, string formatString, string description)
{
    var table = Model.Tables[tableName];
    var m = GetMeasure(table, measureName);

    if(m == null)
        m = table.AddMeasure(measureName, expression);
    else
        m.Expression = expression;

    if(!string.IsNullOrWhiteSpace(displayFolder))
        m.DisplayFolder = displayFolder;

    if(!string.IsNullOrWhiteSpace(formatString))
        m.FormatString = formatString;

    if(!string.IsNullOrWhiteSpace(description))
        m.Description = description;
}

void AddOrReplaceMeasure(string tableName, string measureName, string expression, string displayFolder, string formatString)
{
    AddOrReplaceMeasure(tableName, measureName, expression, displayFolder, formatString, null);
}

void AddOrReplaceMeasure(string tableName, string measureName, string expression, string displayFolder)
{
    AddOrReplaceMeasure(tableName, measureName, expression, displayFolder, null, null);
}

void AddTrendAndMarker(
    string factTable,
    string prefix,
    string columnName,
    string friendlyName,
    string formatString
)
{
    string trendName = prefix + " " + friendlyName + " Trend";
    string anchorDateMeasure = prefix + " Anchor " + friendlyName + " Data Date";
    string markerName = prefix + " " + friendlyName + " Anchor Marker";

    // Trend measure: respects chart context
    AddOrReplaceMeasure(
        factTable,
        trendName,
        "MAX(" + factTable + "[" + columnName + "])",
        prefix + " - Trend Series",
        formatString,
        "Use on line/scatter charts to display metric over time."
    );

    // Marker measure: returns value only on anchor date
    AddOrReplaceMeasure(
        factTable,
        markerName,
        @"
VAR CurrentAxisDate = MAX(" + factTable + @"[exam_date])
VAR AnchorDate = [" + anchorDateMeasure + @"]
RETURN
IF(
    NOT ISBLANK(AnchorDate) && CurrentAxisDate = AnchorDate,
    MAX(" + factTable + "[" + columnName + @"]),
    BLANK()
)",
        prefix + " - Anchor Markers",
        formatString,
        "Use with trend line to highlight the selected/latest anchor exam."
    );
}

// -------------------------------------------------------
// LIPID trend + marker measures
// -------------------------------------------------------
AddTrendAndMarker(lipidTable, "Lipid", "total_cholesterol", "Total Cholesterol", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "hdl", "HDL", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "ldl_final", "LDL Final", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "triglycerides", "TG", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "non_hdl_final", "Non-HDL", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "tc_hdl_ratio", "TC/HDL", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "ldl_hdl_ratio", "LDL/HDL", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "tg_hdl_ratio", "TG/HDL", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "aip", "AIP", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "remnant_cholesterol", "Remnant", "0.00");
AddTrendAndMarker(lipidTable, "Lipid", "lpa", "Lp(a)", "0.00");

// -------------------------------------------------------
// ENDO trend + marker measures
// -------------------------------------------------------
AddTrendAndMarker(endoTable, "Endo", "glucose_for_calc", "Glucose", "0.00");
AddTrendAndMarker(endoTable, "Endo", "fasting_insulin", "Fasting Insulin", "0.00");
AddTrendAndMarker(endoTable, "Endo", "hba1c", "HbA1c", "0.00");
AddTrendAndMarker(endoTable, "Endo", "eag_mgdl", "eAG", "0.00");
AddTrendAndMarker(endoTable, "Endo", "homa_ir", "HOMA-IR", "0.00");
AddTrendAndMarker(endoTable, "Endo", "quicki", "QUICKI", "0.00");
AddTrendAndMarker(endoTable, "Endo", "tsh", "TSH", "0.00");
AddTrendAndMarker(endoTable, "Endo", "free_t4", "Free T4", "0.00");
AddTrendAndMarker(endoTable, "Endo", "tsh_free_t4_ratio", "TSH/Free T4 Ratio", "0.00");
AddTrendAndMarker(endoTable, "Endo", "vitamin_d_25_oh", "Vitamin D", "0.00");

// -------------------------------------------------------
// LIVER trend + marker measures
// -------------------------------------------------------
AddTrendAndMarker(liverTable, "Liver", "ast", "AST", "0.00");
AddTrendAndMarker(liverTable, "Liver", "alt", "ALT", "0.00");
AddTrendAndMarker(liverTable, "Liver", "ggt", "GGT", "0.00");
AddTrendAndMarker(liverTable, "Liver", "alp", "ALP", "0.00");
AddTrendAndMarker(liverTable, "Liver", "total_bilirubin", "Total Bilirubin", "0.00");
AddTrendAndMarker(liverTable, "Liver", "direct_bilirubin", "Direct Bilirubin", "0.00");
AddTrendAndMarker(liverTable, "Liver", "indirect_bilirubin", "Indirect Bilirubin", "0.00");
AddTrendAndMarker(liverTable, "Liver", "direct_total_bilirubin_pct", "Direct/Total Bilirubin %", "0.00");
AddTrendAndMarker(liverTable, "Liver", "ast_alt_ratio", "AST/ALT Ratio", "0.00");
AddTrendAndMarker(liverTable, "Liver", "albumin", "Albumin", "0.00");
AddTrendAndMarker(liverTable, "Liver", "ldh", "LDH", "0.00");

// -------------------------------------------------------
// Optional profile-level anchor marker dates as labels
// -------------------------------------------------------
AddOrReplaceMeasure(
    lipidTable,
    "Lipid Anchor Exam Date Label",
    "FORMAT([Lipid Anchor Exam Date], \"yyyy-mm-dd\")",
    "Lipid - Anchor Markers"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Anchor Exam Date Label",
    "FORMAT([Endo Anchor Exam Date], \"yyyy-mm-dd\")",
    "Endo - Anchor Markers"
);

AddOrReplaceMeasure(
    liverTable,
    "Liver Anchor Exam Date Label",
    "FORMAT([Liver Anchor Exam Date], \"yyyy-mm-dd\")",
    "Liver - Anchor Markers"
);

Info("Trend measures and anchor-marker measures created successfully.");