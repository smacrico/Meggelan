// =======================================================
// Blood Analysis Platform - FULL measure overwrite
// TE2-safe
//
// Fixes latest/previous logic so measures use the latest
// FACT row with nonblank metric values, not max calendar date.
//
// Expected tables:
//   - Fact_LipidMetrics
//   - Fact_EndoMetrics
//   - Dim_Date
// =======================================================

using System;
using System.Linq;
using System.Collections.Generic;

string lipidTable = "Fact_LipidMetrics";
string endoTable  = "Fact_EndoMetrics";
string dateTable  = "Dim_Date";

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

void AddOrReplaceMeasure(string tableName, string measureName, string expression)
{
    AddOrReplaceMeasure(tableName, measureName, expression, null, null, null);
}

void AddMetricPack(
    string factTable,
    string prefix,
    string columnName,
    string friendlyName,
    bool higherIsBetter,
    string numberFormat
)
{
    string latestDate = prefix + " Latest " + friendlyName + " Data Date";
    string prevDate   = prefix + " Previous " + friendlyName + " Data Date";
    string latest     = prefix + " Latest " + friendlyName;
    string previous   = prefix + " Previous " + friendlyName;
    string delta      = prefix + " " + friendlyName + " Delta";
    string deltaPct   = prefix + " " + friendlyName + " Delta %";
    string rolling3   = prefix + " " + friendlyName + " Rolling 3";
    string trend      = prefix + " " + friendlyName + " Trend Direction";

    AddOrReplaceMeasure(
        factTable,
        latestDate,
        @"
MAXX(
    FILTER(
        ALLSELECTED(" + factTable + @"),
        NOT ISBLANK(" + factTable + "[" + columnName + @"])
    ),
    " + factTable + @"[exam_date]
)",
        prefix + " - Data Dates",
        "yyyy-mm-dd"
    );

    AddOrReplaceMeasure(
        factTable,
        prevDate,
        @"
MAXX(
    FILTER(
        ALLSELECTED(" + factTable + @"),
        " + factTable + @"[exam_date] < [" + latestDate + @"]
            && NOT ISBLANK(" + factTable + "[" + columnName + @"])
    ),
    " + factTable + @"[exam_date]
)",
        prefix + " - Data Dates",
        "yyyy-mm-dd"
    );

    AddOrReplaceMeasure(
        factTable,
        latest,
        @"
CALCULATE(
    MAX(" + factTable + "[" + columnName + @"]),
    FILTER(
        ALL(" + factTable + @"),
        " + factTable + @"[exam_date] = [" + latestDate + @"]
    )
)",
        prefix + " - Latest",
        numberFormat
    );

    AddOrReplaceMeasure(
        factTable,
        previous,
        @"
CALCULATE(
    MAX(" + factTable + "[" + columnName + @"]),
    FILTER(
        ALL(" + factTable + @"),
        " + factTable + @"[exam_date] = [" + prevDate + @"]
    )
)",
        prefix + " - Previous",
        numberFormat
    );

    AddOrReplaceMeasure(
        factTable,
        delta,
        "[" + latest + "] - [" + previous + "]",
        prefix + " - Delta",
        numberFormat
    );

    AddOrReplaceMeasure(
        factTable,
        deltaPct,
        "DIVIDE([" + delta + "], [" + previous + "])",
        prefix + " - Delta %",
        "0.00%;-0.00%;0.00%"
    );

    AddOrReplaceMeasure(
        factTable,
        rolling3,
        @"
AVERAGEX(
    TOPN(
        3,
        FILTER(
            ALLSELECTED(" + factTable + @"),
            NOT ISBLANK(" + factTable + "[" + columnName + @"])
        ),
        " + factTable + @"[exam_date], DESC
    ),
    CALCULATE(MAX(" + factTable + "[" + columnName + @"]))
)",
        prefix + " - Rolling 3",
        numberFormat
    );

    string trendExpr;
    if(higherIsBetter)
    {
        trendExpr =
@"
VAR d = [" + delta + @"]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d > 0, ""Improving"",
    d < 0, ""Worsening"",
    ""Stable""
)";
    }
    else
    {
        trendExpr =
@"
VAR d = [" + delta + @"]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, ""Improving"",
    d > 0, ""Worsening"",
    ""Stable""
)";
    }

    AddOrReplaceMeasure(
        factTable,
        trend,
        trendExpr,
        prefix + " - Trend"
    );
}

// -------------------------------------------------------
// Common date labels
// -------------------------------------------------------
AddOrReplaceMeasure(
    dateTable,
    "Latest Selected Calendar Date",
    @"MAX(Dim_Date[Date])",
    "_Common",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    dateTable,
    "Previous Selected Calendar Date",
    @"
CALCULATE(
    MAX(Dim_Date[Date]),
    FILTER(
        ALLSELECTED(Dim_Date[Date]),
        Dim_Date[Date] < [Latest Selected Calendar Date]
    )
)",
    "_Common",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    dateTable,
    "Test Count",
    @"COUNTROWS(VALUES(Dim_Date[Date]))",
    "_Common",
    "0"
);

// -------------------------------------------------------
// LIPID metric packs
// -------------------------------------------------------
AddMetricPack(lipidTable, "Lipid", "total_cholesterol", "Total Cholesterol", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "hdl", "HDL", true, "0.00");
AddMetricPack(lipidTable, "Lipid", "ldl_final", "LDL Final", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "triglycerides", "TG", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "non_hdl_final", "Non-HDL", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "tc_hdl_ratio", "TC/HDL", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "ldl_hdl_ratio", "LDL/HDL", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "tg_hdl_ratio", "TG/HDL", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "aip", "AIP", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "remnant_cholesterol", "Remnant", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "lpa", "Lp(a)", false, "0.00");

// Lipid derived helper measures
AddOrReplaceMeasure(
    lipidTable,
    "Lipid Days Between Latest And Previous Test",
    @"DATEDIFF([Lipid Previous Total Cholesterol Data Date], [Lipid Latest Total Cholesterol Data Date], DAY)",
    "Lipid - Data Dates",
    "0"
);

// Lipid KPI scores
AddOrReplaceMeasure(
    lipidTable,
    "Lipid AIP Score",
    @"
VAR x = [Lipid Latest AIP]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 0.11, 1,
    x < 0.21, 2,
    3
)",
    "Lipid - KPI",
    "0"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid TG/HDL Score",
    @"
VAR x = [Lipid Latest TG/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    x < 4, 3,
    4
)",
    "Lipid - KPI",
    "0"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Remnant Score",
    @"
VAR x = [Lipid Latest Remnant]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, 1,
    x <= 30, 2,
    3
)",
    "Lipid - KPI",
    "0"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid TC/HDL Score",
    @"
VAR x = [Lipid Latest TC/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 4, 1,
    x < 5, 2,
    3
)",
    "Lipid - KPI",
    "0"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid LDL/HDL Score",
    @"
VAR x = [Lipid Latest LDL/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    3
)",
    "Lipid - KPI",
    "0"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Non-HDL Score",
    @"
VAR x = [Lipid Latest Non-HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 130, 1,
    x < 160, 2,
    x < 190, 3,
    4
)",
    "Lipid - KPI",
    "0"
);

// Lipid indicators
AddOrReplaceMeasure(
    lipidTable,
    "Lipid AIP Indicator",
    @"
SWITCH(
    [Lipid AIP Score],
    1, ""Low risk"",
    2, ""Intermediate risk"",
    3, ""High risk"",
    BLANK()
)",
    "Lipid - KPI"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid TG/HDL Indicator",
    @"
SWITCH(
    [Lipid TG/HDL Score],
    1, ""Favorable"",
    2, ""Borderline"",
    3, ""Higher risk"",
    4, ""Marked metabolic-risk signal"",
    BLANK()
)",
    "Lipid - KPI"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Remnant Indicator",
    @"
SWITCH(
    [Lipid Remnant Score],
    1, ""Favorable"",
    2, ""Borderline"",
    3, ""Higher residual risk"",
    BLANK()
)",
    "Lipid - KPI"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid TC/HDL Indicator",
    @"
SWITCH(
    [Lipid TC/HDL Score],
    1, ""Favorable"",
    2, ""Borderline"",
    3, ""Higher risk"",
    BLANK()
)",
    "Lipid - KPI"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid LDL/HDL Indicator",
    @"
SWITCH(
    [Lipid LDL/HDL Score],
    1, ""Favorable"",
    2, ""Borderline"",
    3, ""Less favorable"",
    BLANK()
)",
    "Lipid - KPI"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Non-HDL Indicator",
    @"
SWITCH(
    [Lipid Non-HDL Score],
    1, ""Optimal / near-optimal"",
    2, ""Borderline high"",
    3, ""High"",
    4, ""Very high"",
    BLANK()
)",
    "Lipid - KPI"
);

// Lipid composite
AddOrReplaceMeasure(
    lipidTable,
    "Lipid Composite Risk Score",
    @"
AVERAGEX(
    {
        [Lipid AIP Score],
        [Lipid TG/HDL Score],
        [Lipid Remnant Score],
        [Lipid TC/HDL Score],
        [Lipid LDL/HDL Score],
        [Lipid Non-HDL Score]
    },
    [Value]
)",
    "Lipid - KPI",
    "0.00"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Composite KPI",
    @"
VAR x = [Lipid Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, ""Favorable"",
    x <= 2.3, ""Monitor"",
    x <= 3.2, ""Elevated risk pattern"",
    ""High concern""
)",
    "Lipid - KPI"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Composite Color Hex",
    @"
VAR x = [Lipid Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, ""#2E7D32"",
    x <= 2.3, ""#F9A825"",
    x <= 3.2, ""#EF6C00"",
    ""#C62828""
)",
    "Lipid - KPI"
);

// Lipid stability
AddOrReplaceMeasure(
    lipidTable,
    "Lipid AIP Stability KPI",
    @"ABS([Lipid Latest AIP] - [Lipid AIP Rolling 3])",
    "Lipid - Stability",
    "0.00"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid TG/HDL Stability KPI",
    @"ABS([Lipid Latest TG/HDL] - [Lipid TG/HDL Rolling 3])",
    "Lipid - Stability",
    "0.00"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Remnant Stability KPI",
    @"ABS([Lipid Latest Remnant] - [Lipid Remnant Rolling 3])",
    "Lipid - Stability",
    "0.00"
);

// -------------------------------------------------------
// ENDO metric packs
// -------------------------------------------------------
AddMetricPack(endoTable, "Endo", "glucose_for_calc", "Glucose", false, "0.00");
AddMetricPack(endoTable, "Endo", "fasting_insulin", "Fasting Insulin", false, "0.00");
AddMetricPack(endoTable, "Endo", "hba1c", "HbA1c", false, "0.00");
AddMetricPack(endoTable, "Endo", "eag_mgdl", "eAG", false, "0.00");
AddMetricPack(endoTable, "Endo", "homa_ir", "HOMA-IR", false, "0.00");
AddMetricPack(endoTable, "Endo", "quicki", "QUICKI", true, "0.00");
AddMetricPack(endoTable, "Endo", "tsh", "TSH", false, "0.00");
AddMetricPack(endoTable, "Endo", "free_t4", "Free T4", true, "0.00");
AddMetricPack(endoTable, "Endo", "tsh_free_t4_ratio", "TSH/Free T4 Ratio", false, "0.00");
AddMetricPack(endoTable, "Endo", "vitamin_d_25_oh", "Vitamin D", true, "0.00");

AddOrReplaceMeasure(
    endoTable,
    "Endo Days Between Latest And Previous Test",
    @"DATEDIFF([Endo Previous Glucose Data Date], [Endo Latest Glucose Data Date], DAY)",
    "Endo - Data Dates",
    "0"
);

// Endo scores
AddOrReplaceMeasure(
    endoTable,
    "Endo HOMA-IR Score",
    @"
VAR x = [Endo Latest HOMA-IR]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    3
)",
    "Endo - KPI",
    "0"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo QUICKI Score",
    @"
VAR x = [Endo Latest QUICKI]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x >= 0.35, 1,
    x >= 0.30, 2,
    3
)",
    "Endo - KPI",
    "0"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Vitamin D Score",
    @"
VAR x = [Endo Latest Vitamin D]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, 3,
    x < 30, 2,
    x <= 100, 1,
    3
)",
    "Endo - KPI",
    "0"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo HbA1c Score",
    @"
VAR x = [Endo Latest HbA1c]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 5.7, 1,
    x < 6.5, 2,
    3
)",
    "Endo - KPI",
    "0"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Glucose Score",
    @"
VAR x = [Endo Latest Glucose]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 100, 1,
    x < 126, 2,
    3
)",
    "Endo - KPI",
    "0"
);

// Endo indicators
AddOrReplaceMeasure(
    endoTable,
    "Endo HOMA-IR Indicator",
    @"
SWITCH(
    [Endo HOMA-IR Score],
    1, ""Favorable / insulin sensitive"",
    2, ""Borderline insulin resistance"",
    3, ""Insulin resistance signal"",
    BLANK()
)",
    "Endo - KPI"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo QUICKI Indicator",
    @"
SWITCH(
    [Endo QUICKI Score],
    1, ""Better insulin sensitivity"",
    2, ""Borderline"",
    3, ""Lower insulin sensitivity"",
    BLANK()
)",
    "Endo - KPI"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Vitamin D Indicator",
    @"
VAR x = [Endo Latest Vitamin D]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, ""Deficient"",
    x < 30, ""Insufficient"",
    x <= 50, ""Sufficient"",
    x <= 100, ""High / upper range"",
    ""Potential excess""
)",
    "Endo - KPI"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo HbA1c Indicator",
    @"
SWITCH(
    [Endo HbA1c Score],
    1, ""Favorable"",
    2, ""Prediabetes range"",
    3, ""Diabetes range"",
    BLANK()
)",
    "Endo - KPI"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Glucose Indicator",
    @"
SWITCH(
    [Endo Glucose Score],
    1, ""Favorable"",
    2, ""Impaired fasting range"",
    3, ""High fasting glucose range"",
    BLANK()
)",
    "Endo - KPI"
);

// Endo composite
AddOrReplaceMeasure(
    endoTable,
    "Endo Composite Risk Score",
    @"
AVERAGEX(
    {
        [Endo HOMA-IR Score],
        [Endo QUICKI Score],
        [Endo Vitamin D Score],
        [Endo HbA1c Score],
        [Endo Glucose Score]
    },
    [Value]
)",
    "Endo - KPI",
    "0.00"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Composite KPI",
    @"
VAR x = [Endo Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.4, ""Favorable"",
    x <= 2.1, ""Monitor"",
    x <= 2.8, ""Elevated metabolic/endocrine concern"",
    ""High concern""
)",
    "Endo - KPI"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Composite Color Hex",
    @"
VAR x = [Endo Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.4, ""#2E7D32"",
    x <= 2.1, ""#F9A825"",
    x <= 2.8, ""#EF6C00"",
    ""#C62828""
)",
    "Endo - KPI"
);

// Endo stability
AddOrReplaceMeasure(
    endoTable,
    "Endo HOMA-IR Stability KPI",
    @"ABS([Endo Latest HOMA-IR] - [Endo HOMA-IR Rolling 3])",
    "Endo - Stability",
    "0.00"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo QUICKI Stability KPI",
    @"ABS([Endo Latest QUICKI] - [Endo QUICKI Rolling 3])",
    "Endo - Stability",
    "0.00"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo HbA1c Stability KPI",
    @"ABS([Endo Latest HbA1c] - [Endo HbA1c Rolling 3])",
    "Endo - Stability",
    "0.00"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Vitamin D Stability KPI",
    @"ABS([Endo Latest Vitamin D] - [Endo Vitamin D Rolling 3])",
    "Endo - Stability",
    "0.00"
);

// -------------------------------------------------------
// Combined
// -------------------------------------------------------
AddOrReplaceMeasure(
    lipidTable,
    "Combined Metabolic Risk Score",
    @"
AVERAGEX(
    {
        [Lipid AIP Score],
        [Lipid TG/HDL Score],
        [Lipid Remnant Score],
        [Endo HOMA-IR Score],
        [Endo QUICKI Score],
        [Endo HbA1c Score],
        [Endo Glucose Score]
    },
    [Value]
)",
    "Combined - KPI",
    "0.00"
);

AddOrReplaceMeasure(
    lipidTable,
    "Combined Metabolic KPI",
    @"
VAR x = [Combined Metabolic Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, ""Favorable"",
    x <= 2.2, ""Monitor"",
    x <= 3.0, ""Elevated combined metabolic risk"",
    ""High combined metabolic risk""
)",
    "Combined - KPI"
);

AddOrReplaceMeasure(
    lipidTable,
    "Combined Metabolic Color Hex",
    @"
VAR x = [Combined Metabolic Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, ""#2E7D32"",
    x <= 2.2, ""#F9A825"",
    x <= 3.0, ""#EF6C00"",
    ""#C62828""
)",
    "Combined - KPI"
);

Info("All core measures overwritten with fact-driven latest/previous pattern successfully.");