// =======================================================
// Blood Analysis Platform - FULL overwrite measure pack
// TE2-safe
//
// Architecture:
// - disconnected 'Exam Selector'[ExamDate]
// - selected anchor date with latest fallback
// - previous exam logic
// - lipid + endo + liver
//
// Expected tables:
//   - Fact_LipidMetrics
//   - Fact_EndoMetrics
//   - Fact_LiverMetrics
//   - Dim_Date
//   - Exam Selector
// =======================================================

using System;
using System.Linq;
using System.Collections.Generic;

string lipidTable = "Fact_LipidMetrics";
string endoTable  = "Fact_EndoMetrics";
string liverTable = "Fact_LiverMetrics";
string dateTable  = "Dim_Date";
string selectorTable = "Exam Selector";
string selectorColumn = "ExamDate";

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

// -------------------------------------------------------
// Shared disconnected selector measure
// -------------------------------------------------------
AddOrReplaceMeasure(
    dateTable,
    "Selected Anchor Calendar Date",
    "SELECTEDVALUE('" + selectorTable + "'[" + selectorColumn + "])",
    "_Common",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    dateTable,
    "Latest Selected Calendar Date",
    "MAX(" + dateTable + "[Date])",
    "_Common",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    dateTable,
    "Test Count",
    "COUNTROWS(VALUES(" + dateTable + "[Date]))",
    "_Common",
    "0"
);

// -------------------------------------------------------
// Generic metric pack generator using selected exam logic
// -------------------------------------------------------
void AddMetricPack(
    string factTable,
    string prefix,
    string anchorBaseName,
    string columnName,
    string friendlyName,
    bool higherIsBetter,
    string numberFormat
)
{
    string anchorDate = prefix + " Anchor Exam Date";
    string prevExamDate = prefix + " Previous Exam Date";

    string latestDateForMetric = prefix + " Anchor " + friendlyName + " Data Date";
    string previousDateForMetric = prefix + " Previous " + friendlyName + " Data Date";

    string latest = prefix + " " + friendlyName;
    string previous = prefix + " Previous " + friendlyName;
    string delta = prefix + " " + friendlyName + " Delta";
    string deltaPct = prefix + " " + friendlyName + " Delta %";
    string rolling3 = prefix + " " + friendlyName + " Rolling 3";
    string trend = prefix + " " + friendlyName + " Trend Direction";

    // metric-specific anchor date: selected date or latest fallback
    AddOrReplaceMeasure(
        factTable,
        latestDateForMetric,
        @"
VAR SelectedDate = [Selected Anchor Calendar Date]
RETURN
IF(
    NOT ISBLANK(SelectedDate),
    MAXX(
        FILTER(
            ALLSELECTED(" + factTable + @"),
            " + factTable + @"[exam_date] <= SelectedDate
                && NOT ISBLANK(" + factTable + "[" + columnName + @"])
        ),
        " + factTable + @"[exam_date]
    ),
    MAXX(
        FILTER(
            ALLSELECTED(" + factTable + @"),
            NOT ISBLANK(" + factTable + "[" + columnName + @"])
        ),
        " + factTable + @"[exam_date]
    )
)",
        prefix + " - Data Dates",
        "yyyy-mm-dd"
    );

    AddOrReplaceMeasure(
        factTable,
        previousDateForMetric,
        @"
MAXX(
    FILTER(
        ALLSELECTED(" + factTable + @"),
        " + factTable + @"[exam_date] < [" + latestDateForMetric + @"]
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
        " + factTable + @"[exam_date] = [" + latestDateForMetric + @"]
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
        " + factTable + @"[exam_date] = [" + previousDateForMetric + @"]
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
            " + factTable + @"[exam_date] <= [" + latestDateForMetric + @"]
                && NOT ISBLANK(" + factTable + "[" + columnName + @"])
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
// PROFILE anchor exam dates
// -------------------------------------------------------
AddOrReplaceMeasure(
    lipidTable,
    "Lipid Anchor Exam Date",
    @"
VAR SelectedDate = [Selected Anchor Calendar Date]
RETURN
IF(
    NOT ISBLANK(SelectedDate),
    MAXX(
        FILTER(
            ALLSELECTED(" + lipidTable + @"),
            " + lipidTable + @"[exam_date] <= SelectedDate
                && NOT ISBLANK(" + lipidTable + @"[total_cholesterol])
        ),
        " + lipidTable + @"[exam_date]
    ),
    MAXX(
        FILTER(
            ALLSELECTED(" + lipidTable + @"),
            NOT ISBLANK(" + lipidTable + @"[total_cholesterol])
        ),
        " + lipidTable + @"[exam_date]
    )
)",
    "Lipid - Data Dates",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Previous Exam Date",
    @"
MAXX(
    FILTER(
        ALLSELECTED(" + lipidTable + @"),
        " + lipidTable + @"[exam_date] < [Lipid Anchor Exam Date]
            && NOT ISBLANK(" + lipidTable + @"[total_cholesterol])
    ),
    " + lipidTable + @"[exam_date]
)",
    "Lipid - Data Dates",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Anchor Exam Date",
    @"
VAR SelectedDate = [Selected Anchor Calendar Date]
RETURN
IF(
    NOT ISBLANK(SelectedDate),
    MAXX(
        FILTER(
            ALLSELECTED(" + endoTable + @"),
            " + endoTable + @"[exam_date] <= SelectedDate
                && NOT ISBLANK(" + endoTable + @"[glucose_for_calc])
        ),
        " + endoTable + @"[exam_date]
    ),
    MAXX(
        FILTER(
            ALLSELECTED(" + endoTable + @"),
            NOT ISBLANK(" + endoTable + @"[glucose_for_calc])
        ),
        " + endoTable + @"[exam_date]
    )
)",
    "Endo - Data Dates",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Previous Exam Date",
    @"
MAXX(
    FILTER(
        ALLSELECTED(" + endoTable + @"),
        " + endoTable + @"[exam_date] < [Endo Anchor Exam Date]
            && NOT ISBLANK(" + endoTable + @"[glucose_for_calc])
    ),
    " + endoTable + @"[exam_date]
)",
    "Endo - Data Dates",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    liverTable,
    "Liver Anchor Exam Date",
    @"
VAR SelectedDate = [Selected Anchor Calendar Date]
RETURN
IF(
    NOT ISBLANK(SelectedDate),
    MAXX(
        FILTER(
            ALLSELECTED(" + liverTable + @"),
            " + liverTable + @"[exam_date] <= SelectedDate
                && NOT ISBLANK(" + liverTable + @"[ast])
        ),
        " + liverTable + @"[exam_date]
    ),
    MAXX(
        FILTER(
            ALLSELECTED(" + liverTable + @"),
            NOT ISBLANK(" + liverTable + @"[ast])
        ),
        " + liverTable + @"[exam_date]
    )
)",
    "Liver - Data Dates",
    "yyyy-mm-dd"
);

AddOrReplaceMeasure(
    liverTable,
    "Liver Previous Exam Date",
    @"
MAXX(
    FILTER(
        ALLSELECTED(" + liverTable + @"),
        " + liverTable + @"[exam_date] < [Liver Anchor Exam Date]
            && NOT ISBLANK(" + liverTable + @"[ast])
    ),
    " + liverTable + @"[exam_date]
)",
    "Liver - Data Dates",
    "yyyy-mm-dd"
);

// -------------------------------------------------------
// LIPID metric packs
// -------------------------------------------------------
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "total_cholesterol", "Total Cholesterol", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "hdl", "HDL", true, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "ldl_final", "LDL Final", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "triglycerides", "TG", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "non_hdl_final", "Non-HDL", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "tc_hdl_ratio", "TC/HDL", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "ldl_hdl_ratio", "LDL/HDL", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "tg_hdl_ratio", "TG/HDL", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "aip", "AIP", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "remnant_cholesterol", "Remnant", false, "0.00");
AddMetricPack(lipidTable, "Lipid", "Lipid Anchor Exam Date", "lpa", "Lp(a)", false, "0.00");

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Days Between Latest And Previous Test",
    @"DATEDIFF([Lipid Previous Exam Date], [Lipid Anchor Exam Date], DAY)",
    "Lipid - Data Dates",
    "0"
);

// Lipid KPI scores
AddOrReplaceMeasure(lipidTable, "Lipid AIP Score", @"
VAR x = [Lipid AIP]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 0.11, 1,
    x < 0.21, 2,
    3
)", "Lipid - KPI", "0");

AddOrReplaceMeasure(lipidTable, "Lipid TG/HDL Score", @"
VAR x = [Lipid TG/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    x < 4, 3,
    4
)", "Lipid - KPI", "0");

AddOrReplaceMeasure(lipidTable, "Lipid Remnant Score", @"
VAR x = [Lipid Remnant]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, 1,
    x <= 30, 2,
    3
)", "Lipid - KPI", "0");

AddOrReplaceMeasure(lipidTable, "Lipid TC/HDL Score", @"
VAR x = [Lipid TC/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 4, 1,
    x < 5, 2,
    3
)", "Lipid - KPI", "0");

AddOrReplaceMeasure(lipidTable, "Lipid LDL/HDL Score", @"
VAR x = [Lipid LDL/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    3
)", "Lipid - KPI", "0");

AddOrReplaceMeasure(lipidTable, "Lipid Non-HDL Score", @"
VAR x = [Lipid Non-HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 130, 1,
    x < 160, 2,
    x < 190, 3,
    4
)", "Lipid - KPI", "0");

// Lipid indicators
AddOrReplaceMeasure(lipidTable, "Lipid AIP Indicator", @"
SWITCH(
    [Lipid AIP Score],
    1, ""Low risk"",
    2, ""Intermediate risk"",
    3, ""High risk"",
    BLANK()
)", "Lipid - KPI");

AddOrReplaceMeasure(lipidTable, "Lipid TG/HDL Indicator", @"
SWITCH(
    [Lipid TG/HDL Score],
    1, ""Favorable"",
    2, ""Borderline"",
    3, ""Higher risk"",
    4, ""Marked metabolic-risk signal"",
    BLANK()
)", "Lipid - KPI");

AddOrReplaceMeasure(lipidTable, "Lipid Remnant Indicator", @"
SWITCH(
    [Lipid Remnant Score],
    1, ""Favorable"",
    2, ""Borderline"",
    3, ""Higher residual risk"",
    BLANK()
)", "Lipid - KPI");

AddOrReplaceMeasure(lipidTable, "Lipid TC/HDL Indicator", @"
SWITCH(
    [Lipid TC/HDL Score],
    1, ""Favorable"",
    2, ""Borderline"",
    3, ""Higher risk"",
    BLANK()
)", "Lipid - KPI");

AddOrReplaceMeasure(lipidTable, "Lipid LDL/HDL Indicator", @"
SWITCH(
    [Lipid LDL/HDL Score],
    1, ""Favorable"",
    2, ""Borderline"",
    3, ""Less favorable"",
    BLANK()
)", "Lipid - KPI");

AddOrReplaceMeasure(lipidTable, "Lipid Non-HDL Indicator", @"
SWITCH(
    [Lipid Non-HDL Score],
    1, ""Optimal / near-optimal"",
    2, ""Borderline high"",
    3, ""High"",
    4, ""Very high"",
    BLANK()
)", "Lipid - KPI");

// Lipid composite
AddOrReplaceMeasure(lipidTable, "Lipid Composite Risk Score", @"
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
)", "Lipid - KPI", "0.00");

AddOrReplaceMeasure(lipidTable, "Lipid Composite KPI", @"
VAR x = [Lipid Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, ""Favorable"",
    x <= 2.3, ""Monitor"",
    x <= 3.2, ""Elevated risk pattern"",
    ""High concern""
)", "Lipid - KPI");

AddOrReplaceMeasure(lipidTable, "Lipid Composite Color Hex", @"
VAR x = [Lipid Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, ""#2E7D32"",
    x <= 2.3, ""#F9A825"",
    x <= 3.2, ""#EF6C00"",
    ""#C62828""
)", "Lipid - KPI");

// Lipid stability
AddOrReplaceMeasure(lipidTable, "Lipid AIP Stability KPI", @"ABS([Lipid AIP] - [Lipid AIP Rolling 3])", "Lipid - Stability", "0.00");
AddOrReplaceMeasure(lipidTable, "Lipid TG/HDL Stability KPI", @"ABS([Lipid TG/HDL] - [Lipid TG/HDL Rolling 3])", "Lipid - Stability", "0.00");
AddOrReplaceMeasure(lipidTable, "Lipid Remnant Stability KPI", @"ABS([Lipid Remnant] - [Lipid Remnant Rolling 3])", "Lipid - Stability", "0.00");

// -------------------------------------------------------
// ENDO metric packs
// -------------------------------------------------------
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "glucose_for_calc", "Glucose", false, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "fasting_insulin", "Fasting Insulin", false, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "hba1c", "HbA1c", false, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "eag_mgdl", "eAG", false, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "homa_ir", "HOMA-IR", false, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "quicki", "QUICKI", true, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "tsh", "TSH", false, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "free_t4", "Free T4", true, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "tsh_free_t4_ratio", "TSH/Free T4 Ratio", false, "0.00");
AddMetricPack(endoTable, "Endo", "Endo Anchor Exam Date", "vitamin_d_25_oh", "Vitamin D", true, "0.00");

AddOrReplaceMeasure(
    endoTable,
    "Endo Days Between Latest And Previous Test",
    @"DATEDIFF([Endo Previous Exam Date], [Endo Anchor Exam Date], DAY)",
    "Endo - Data Dates",
    "0"
);

// Endo scores
AddOrReplaceMeasure(endoTable, "Endo HOMA-IR Score", @"
VAR x = [Endo HOMA-IR]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    3
)", "Endo - KPI", "0");

AddOrReplaceMeasure(endoTable, "Endo QUICKI Score", @"
VAR x = [Endo QUICKI]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x >= 0.35, 1,
    x >= 0.30, 2,
    3
)", "Endo - KPI", "0");

AddOrReplaceMeasure(endoTable, "Endo Vitamin D Score", @"
VAR x = [Endo Vitamin D]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, 3,
    x < 30, 2,
    x <= 100, 1,
    3
)", "Endo - KPI", "0");

AddOrReplaceMeasure(endoTable, "Endo HbA1c Score", @"
VAR x = [Endo HbA1c]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 5.7, 1,
    x < 6.5, 2,
    3
)", "Endo - KPI", "0");

AddOrReplaceMeasure(endoTable, "Endo Glucose Score", @"
VAR x = [Endo Glucose]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 100, 1,
    x < 126, 2,
    3
)", "Endo - KPI", "0");

// Endo indicators
AddOrReplaceMeasure(endoTable, "Endo HOMA-IR Indicator", @"
SWITCH(
    [Endo HOMA-IR Score],
    1, ""Favorable / insulin sensitive"",
    2, ""Borderline insulin resistance"",
    3, ""Insulin resistance signal"",
    BLANK()
)", "Endo - KPI");

AddOrReplaceMeasure(endoTable, "Endo QUICKI Indicator", @"
SWITCH(
    [Endo QUICKI Score],
    1, ""Better insulin sensitivity"",
    2, ""Borderline"",
    3, ""Lower insulin sensitivity"",
    BLANK()
)", "Endo - KPI");

AddOrReplaceMeasure(endoTable, "Endo Vitamin D Indicator", @"
VAR x = [Endo Vitamin D]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, ""Deficient"",
    x < 30, ""Insufficient"",
    x <= 50, ""Sufficient"",
    x <= 100, ""High / upper range"",
    ""Potential excess""
)", "Endo - KPI");

AddOrReplaceMeasure(endoTable, "Endo HbA1c Indicator", @"
SWITCH(
    [Endo HbA1c Score],
    1, ""Favorable"",
    2, ""Prediabetes range"",
    3, ""Diabetes range"",
    BLANK()
)", "Endo - KPI");

AddOrReplaceMeasure(endoTable, "Endo Glucose Indicator", @"
SWITCH(
    [Endo Glucose Score],
    1, ""Favorable"",
    2, ""Impaired fasting range"",
    3, ""High fasting glucose range"",
    BLANK()
)", "Endo - KPI");

// Endo composite
AddOrReplaceMeasure(endoTable, "Endo Composite Risk Score", @"
AVERAGEX(
    {
        [Endo HOMA-IR Score],
        [Endo QUICKI Score],
        [Endo Vitamin D Score],
        [Endo HbA1c Score],
        [Endo Glucose Score]
    },
    [Value]
)", "Endo - KPI", "0.00");

AddOrReplaceMeasure(endoTable, "Endo Composite KPI", @"
VAR x = [Endo Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.4, ""Favorable"",
    x <= 2.1, ""Monitor"",
    x <= 2.8, ""Elevated metabolic/endocrine concern"",
    ""High concern""
)", "Endo - KPI");

AddOrReplaceMeasure(endoTable, "Endo Composite Color Hex", @"
VAR x = [Endo Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.4, ""#2E7D32"",
    x <= 2.1, ""#F9A825"",
    x <= 2.8, ""#EF6C00"",
    ""#C62828""
)", "Endo - KPI");

// Endo stability
AddOrReplaceMeasure(endoTable, "Endo HOMA-IR Stability KPI", @"ABS([Endo HOMA-IR] - [Endo HOMA-IR Rolling 3])", "Endo - Stability", "0.00");
AddOrReplaceMeasure(endoTable, "Endo QUICKI Stability KPI", @"ABS([Endo QUICKI] - [Endo QUICKI Rolling 3])", "Endo - Stability", "0.00");
AddOrReplaceMeasure(endoTable, "Endo HbA1c Stability KPI", @"ABS([Endo HbA1c] - [Endo HbA1c Rolling 3])", "Endo - Stability", "0.00");
AddOrReplaceMeasure(endoTable, "Endo Vitamin D Stability KPI", @"ABS([Endo Vitamin D] - [Endo Vitamin D Rolling 3])", "Endo - Stability", "0.00");

// -------------------------------------------------------
// LIVER metric packs
// -------------------------------------------------------
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "ast", "AST", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "alt", "ALT", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "ggt", "GGT", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "alp", "ALP", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "total_bilirubin", "Total Bilirubin", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "direct_bilirubin", "Direct Bilirubin", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "indirect_bilirubin", "Indirect Bilirubin", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "direct_total_bilirubin_pct", "Direct/Total Bilirubin %", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "ast_alt_ratio", "AST/ALT Ratio", false, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "albumin", "Albumin", true, "0.00");
AddMetricPack(liverTable, "Liver", "Liver Anchor Exam Date", "ldh", "LDH", false, "0.00");

AddOrReplaceMeasure(
    liverTable,
    "Liver Days Between Latest And Previous Test",
    @"DATEDIFF([Liver Previous Exam Date], [Liver Anchor Exam Date], DAY)",
    "Liver - Data Dates",
    "0"
);

// Liver indicators / pattern helpers
AddOrReplaceMeasure(liverTable, "Liver AST/ALT Pattern Indicator", @"
VAR x = [Liver AST/ALT Ratio]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 0.5, ""ALT-predominant"",
    x >= 0.7 && x <= 1.2, ""Balanced"",
    x > 1.2 && x <= 2.0, ""Borderline pattern"",
    x > 2.0, ""AST-predominant / stronger concern"",
    ""Borderline pattern""
)", "Liver - KPI");

AddOrReplaceMeasure(liverTable, "Liver Direct Bilirubin % Indicator", @"
VAR x = [Liver Direct/Total Bilirubin %]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, ""Low direct fraction"",
    x < 30, ""Balanced"",
    x <= 40, ""Borderline direct-predominant"",
    ""Higher direct-predominant pattern""
)", "Liver - KPI");

AddOrReplaceMeasure(liverTable, "Liver AST/ALT Score", @"
VAR x = [Liver AST/ALT Ratio]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x >= 0.7 && x <= 1.2, 1,
    (x >= 0.5 && x < 0.7) || (x > 1.2 && x <= 2.0), 2,
    3
)", "Liver - KPI", "0");

AddOrReplaceMeasure(liverTable, "Liver Direct Bilirubin % Score", @"
VAR x = [Liver Direct/Total Bilirubin %]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 30, 1,
    x <= 40, 2,
    3
)", "Liver - KPI", "0");

AddOrReplaceMeasure(liverTable, "Liver Composite Risk Score", @"
AVERAGEX(
    {
        [Liver AST/ALT Score],
        [Liver Direct Bilirubin % Score]
    },
    [Value]
)", "Liver - KPI", "0.00");

AddOrReplaceMeasure(liverTable, "Liver Composite KPI", @"
VAR x = [Liver Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.4, ""Favorable"",
    x <= 2.1, ""Monitor"",
    ""Elevated liver-pattern concern""
)", "Liver - KPI");

AddOrReplaceMeasure(liverTable, "Liver Composite Color Hex", @"
VAR x = [Liver Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.4, ""#2E7D32"",
    x <= 2.1, ""#F9A825"",
    ""#C62828""
)", "Liver - KPI");

// Liver stability
AddOrReplaceMeasure(liverTable, "Liver AST/ALT Ratio Stability KPI", @"ABS([Liver AST/ALT Ratio] - [Liver AST/ALT Ratio Rolling 3])", "Liver - Stability", "0.00");
AddOrReplaceMeasure(liverTable, "Liver Direct/Total Bilirubin % Stability KPI", @"ABS([Liver Direct/Total Bilirubin %] - [Liver Direct/Total Bilirubin % Rolling 3])", "Liver - Stability", "0.00");

// -------------------------------------------------------
// Combined metabolic / cross-profile
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

// -------------------------------------------------------
// Formatting helper color measures
// -------------------------------------------------------
AddOrReplaceMeasure(lipidTable, "Color - Good", "\"#2E7D32\"", "Formatting - Colors");
AddOrReplaceMeasure(lipidTable, "Color - Warning", "\"#F9A825\"", "Formatting - Colors");
AddOrReplaceMeasure(lipidTable, "Color - Elevated", "\"#EF6C00\"", "Formatting - Colors");
AddOrReplaceMeasure(lipidTable, "Color - Bad", "\"#C62828\"", "Formatting - Colors");
AddOrReplaceMeasure(lipidTable, "Color - Stable", "\"#9E9E9E\"", "Formatting - Colors");

AddOrReplaceMeasure(lipidTable, "Lipid AIP Color Hex", @"
SWITCH(
    [Lipid AIP Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)", "Formatting - Lipid");

AddOrReplaceMeasure(lipidTable, "Lipid TG/HDL Color Hex", @"
SWITCH(
    [Lipid TG/HDL Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#EF6C00"",
    4, ""#C62828"",
    BLANK()
)", "Formatting - Lipid");

AddOrReplaceMeasure(lipidTable, "Lipid Remnant Color Hex", @"
SWITCH(
    [Lipid Remnant Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)", "Formatting - Lipid");

AddOrReplaceMeasure(endoTable, "Endo HOMA-IR Color Hex", @"
SWITCH(
    [Endo HOMA-IR Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)", "Formatting - Endo");

AddOrReplaceMeasure(endoTable, "Endo QUICKI Color Hex", @"
SWITCH(
    [Endo QUICKI Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)", "Formatting - Endo");

AddOrReplaceMeasure(endoTable, "Endo Vitamin D Color Hex", @"
SWITCH(
    [Endo Vitamin D Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)", "Formatting - Endo");

AddOrReplaceMeasure(liverTable, "Liver Composite Background Hex", "[Liver Composite Color Hex]", "Formatting - Liver");
AddOrReplaceMeasure(lipidTable, "Lipid Composite Background Hex", "[Lipid Composite Color Hex]", "Formatting - Lipid");
AddOrReplaceMeasure(endoTable, "Endo Composite Background Hex", "[Endo Composite Color Hex]", "Formatting - Endo");
AddOrReplaceMeasure(lipidTable, "Combined KPI Background Hex", "[Combined Metabolic Color Hex]", "Formatting - Combined");

Info("Full TE2 overwrite script completed successfully: selected exam date with latest fallback architecture applied for lipid, endocrinology, and liver.");