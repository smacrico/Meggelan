// =======================================================
// Blood Analysis Platform - Targets / Bands / Titles Patch
// TE2-safe
//
// Adds:
//   1. Target line measures
//   2. Reference band measures
//   3. Dynamic chart title measures
//
// Expected tables:
//   - Fact_LipidMetrics
//   - Fact_EndoMetrics
//   - Fact_LiverMetrics
//
// Requires existing anchor exam date measures:
//   - Lipid Anchor Exam Date
//   - Endo Anchor Exam Date
//   - Liver Anchor Exam Date
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

void AddTarget(string tableName, string measureName, string value, string folder, string formatString)
{
    AddOrReplaceMeasure(
        tableName,
        measureName,
        value,
        folder,
        formatString,
        "Static target/reference line."
    );
}

void AddTitle(string tableName, string measureName, string label, string anchorDateMeasure, string folder)
{
    AddOrReplaceMeasure(
        tableName,
        measureName,
        @"
VAR AnchorDate = [" + anchorDateMeasure + @"]
RETURN
""" + label + @" Trend — Anchor: "" &
IF(
    ISBLANK(AnchorDate),
    ""n/a"",
    FORMAT(AnchorDate, ""yyyy-mm-dd"")
)",
        folder,
        null,
        "Dynamic chart title with anchor date."
    );
}

// -------------------------------------------------------
// LIPID - Targets
// -------------------------------------------------------
string lipidTargetFolder = "Lipid - Targets";
string lipidBandFolder   = "Lipid - Reference Bands";
string lipidTitleFolder  = "Lipid - Titles";

AddTarget(lipidTable, "Lipid Total Cholesterol Target", "200", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid HDL Target", "60", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid LDL Final Target", "100", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid TG Target", "150", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid Non-HDL Target", "130", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid TC/HDL Target", "4.0", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid LDL/HDL Target", "2.0", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid TG/HDL Target", "2.0", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid AIP Target", "0.11", lipidTargetFolder, "0.00");
AddTarget(lipidTable, "Lipid Remnant Target", "20", lipidTargetFolder, "0.00");

// Lipid reference bands
AddTarget(lipidTable, "Lipid HDL Favorable Floor", "60", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid TG Favorable Ceiling", "150", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid Non-HDL Favorable Ceiling", "130", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid TC/HDL Favorable Ceiling", "4.0", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid LDL/HDL Favorable Ceiling", "2.0", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid TG/HDL Favorable Ceiling", "2.0", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid TG/HDL Borderline Ceiling", "3.0", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid TG/HDL Higher Risk Ceiling", "4.0", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid AIP Low Risk Ceiling", "0.11", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid AIP Intermediate Risk Ceiling", "0.21", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid Remnant Favorable Ceiling", "20", lipidBandFolder, "0.00");
AddTarget(lipidTable, "Lipid Remnant Borderline Ceiling", "30", lipidBandFolder, "0.00");

// Lipid titles
AddTitle(lipidTable, "Lipid Total Cholesterol Trend Title", "Total Cholesterol", "Lipid Anchor Total Cholesterol Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid HDL Trend Title", "HDL", "Lipid Anchor HDL Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid LDL Final Trend Title", "LDL Final", "Lipid Anchor LDL Final Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid TG Trend Title", "Triglycerides", "Lipid Anchor TG Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid Non-HDL Trend Title", "Non-HDL", "Lipid Anchor Non-HDL Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid TC/HDL Trend Title", "TC/HDL", "Lipid Anchor TC/HDL Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid LDL/HDL Trend Title", "LDL/HDL", "Lipid Anchor LDL/HDL Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid TG/HDL Trend Title", "TG/HDL", "Lipid Anchor TG/HDL Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid AIP Trend Title", "AIP", "Lipid Anchor AIP Data Date", lipidTitleFolder);
AddTitle(lipidTable, "Lipid Remnant Trend Title", "Remnant Cholesterol", "Lipid Anchor Remnant Data Date", lipidTitleFolder);

// -------------------------------------------------------
// ENDO - Targets
// -------------------------------------------------------
string endoTargetFolder = "Endo - Targets";
string endoBandFolder   = "Endo - Reference Bands";
string endoTitleFolder  = "Endo - Titles";

AddTarget(endoTable, "Endo Glucose Target", "100", endoTargetFolder, "0.00");
AddTarget(endoTable, "Endo Fasting Insulin Target", "10", endoTargetFolder, "0.00");
AddTarget(endoTable, "Endo HbA1c Target", "5.7", endoTargetFolder, "0.00");
AddTarget(endoTable, "Endo eAG Target", "117", endoTargetFolder, "0.00");
AddTarget(endoTable, "Endo HOMA-IR Target", "2.0", endoTargetFolder, "0.00");
AddTarget(endoTable, "Endo QUICKI Target", "0.35", endoTargetFolder, "0.00");
AddTarget(endoTable, "Endo Vitamin D Target", "30", endoTargetFolder, "0.00");

// Endo reference bands
AddTarget(endoTable, "Endo Glucose Favorable Ceiling", "100", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo Glucose Prediabetes Ceiling", "126", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo HbA1c Favorable Ceiling", "5.7", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo HbA1c Prediabetes Ceiling", "6.5", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo HOMA-IR Favorable Ceiling", "2.0", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo HOMA-IR Borderline Ceiling", "3.0", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo QUICKI Favorable Floor", "0.35", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo QUICKI Borderline Floor", "0.30", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo Vitamin D Deficient Ceiling", "20", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo Vitamin D Insufficient Ceiling", "30", endoBandFolder, "0.00");
AddTarget(endoTable, "Endo Vitamin D Sufficient Ceiling", "50", endoBandFolder, "0.00");

// Endo titles
AddTitle(endoTable, "Endo Glucose Trend Title", "Glucose", "Endo Anchor Glucose Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo Fasting Insulin Trend Title", "Fasting Insulin", "Endo Anchor Fasting Insulin Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo HbA1c Trend Title", "HbA1c", "Endo Anchor HbA1c Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo eAG Trend Title", "eAG", "Endo Anchor eAG Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo HOMA-IR Trend Title", "HOMA-IR", "Endo Anchor HOMA-IR Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo QUICKI Trend Title", "QUICKI", "Endo Anchor QUICKI Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo TSH Trend Title", "TSH", "Endo Anchor TSH Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo Free T4 Trend Title", "Free T4", "Endo Anchor Free T4 Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo TSH/Free T4 Ratio Trend Title", "TSH/Free T4 Ratio", "Endo Anchor TSH/Free T4 Ratio Data Date", endoTitleFolder);
AddTitle(endoTable, "Endo Vitamin D Trend Title", "Vitamin D", "Endo Anchor Vitamin D Data Date", endoTitleFolder);

// -------------------------------------------------------
// LIVER - Targets
// -------------------------------------------------------
string liverTargetFolder = "Liver - Targets";
string liverBandFolder   = "Liver - Reference Bands";
string liverTitleFolder  = "Liver - Titles";

AddTarget(liverTable, "Liver AST/ALT Ratio Target", "1.0", liverTargetFolder, "0.00");
AddTarget(liverTable, "Liver Direct/Total Bilirubin % Target", "30", liverTargetFolder, "0.00");

// Liver reference bands
AddTarget(liverTable, "Liver AST/ALT Balanced Lower", "0.7", liverBandFolder, "0.00");
AddTarget(liverTable, "Liver AST/ALT Balanced Upper", "1.2", liverBandFolder, "0.00");
AddTarget(liverTable, "Liver AST/ALT Concern Ceiling", "2.0", liverBandFolder, "0.00");
AddTarget(liverTable, "Liver Direct Bilirubin % Balanced Ceiling", "30", liverBandFolder, "0.00");
AddTarget(liverTable, "Liver Direct Bilirubin % Borderline Ceiling", "40", liverBandFolder, "0.00");

// Liver titles
AddTitle(liverTable, "Liver AST Trend Title", "AST", "Liver Anchor AST Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver ALT Trend Title", "ALT", "Liver Anchor ALT Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver GGT Trend Title", "GGT", "Liver Anchor GGT Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver ALP Trend Title", "ALP", "Liver Anchor ALP Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver Total Bilirubin Trend Title", "Total Bilirubin", "Liver Anchor Total Bilirubin Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver Direct Bilirubin Trend Title", "Direct Bilirubin", "Liver Anchor Direct Bilirubin Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver Indirect Bilirubin Trend Title", "Indirect Bilirubin", "Liver Anchor Indirect Bilirubin Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver AST/ALT Ratio Trend Title", "AST/ALT Ratio", "Liver Anchor AST/ALT Ratio Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver Direct/Total Bilirubin % Trend Title", "Direct/Total Bilirubin %", "Liver Anchor Direct/Total Bilirubin % Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver Albumin Trend Title", "Albumin", "Liver Anchor Albumin Data Date", liverTitleFolder);
AddTitle(liverTable, "Liver LDH Trend Title", "LDH", "Liver Anchor LDH Data Date", liverTitleFolder);

// -------------------------------------------------------
// Combined titles
// -------------------------------------------------------
AddOrReplaceMeasure(
    lipidTable,
    "Combined Metabolic Trend Title",
    @"
VAR LDate = [Lipid Anchor Exam Date]
VAR EDate = [Endo Anchor Exam Date]
RETURN
""Combined Metabolic Trends — Lipid Anchor: "" &
IF(ISBLANK(LDate), ""n/a"", FORMAT(LDate, ""yyyy-mm-dd"")) &
"" | Endo Anchor: "" &
IF(ISBLANK(EDate), ""n/a"", FORMAT(EDate, ""yyyy-mm-dd""))
",
    "Combined - Titles",
    null,
    "Dynamic combined trend title."
);

Info("Targets, reference bands, and dynamic chart titles created successfully.");