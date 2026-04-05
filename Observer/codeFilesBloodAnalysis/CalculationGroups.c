// =======================================================
// Blood Analysis Platform - Trend Calculation Group
// + KPI Color Measures
// TE2-safe version
// =======================================================

using System;
using System.Linq;
using System.Collections.Generic;

string lipidTable = "Fact_LipidMetrics";
string endoTable  = "Fact_EndoMetrics";

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
    {
        m = table.AddMeasure(measureName, expression);
    }
    else
    {
        m.Expression = expression;
    }

    if(!string.IsNullOrWhiteSpace(displayFolder))
        m.DisplayFolder = displayFolder;

    if(!string.IsNullOrWhiteSpace(formatString))
        m.FormatString = formatString;

    if(!string.IsNullOrWhiteSpace(description))
        m.Description = description;
}

void AddOrReplaceMeasure(string tableName, string measureName, string expression, string displayFolder)
{
    AddOrReplaceMeasure(tableName, measureName, expression, displayFolder, null, null);
}

void AddOrReplaceMeasure(string tableName, string measureName, string expression)
{
    AddOrReplaceMeasure(tableName, measureName, expression, null, null, null);
}

CalculationGroupTable GetCalcGroup(string name)
{
    return Model.Tables.FirstOrDefault(t => t.Name == name) as CalculationGroupTable;
}

CalculationItem GetCalcItem(CalculationGroupTable cg, string name)
{
    return cg.CalculationItems.FirstOrDefault(x => x.Name == name);
}

void AddOrReplaceCalcItem(CalculationGroupTable cg, string itemName, string expression, string formatStringExpression, string description)
{
    var item = GetCalcItem(cg, itemName);
    if(item == null)
        item = cg.AddCalculationItem(itemName);

    item.Expression = expression;

    if(!string.IsNullOrWhiteSpace(formatStringExpression))
        item.FormatStringExpression = formatStringExpression;

    if(!string.IsNullOrWhiteSpace(description))
        item.Description = description;
}

// -------------------------------------------------------
// Ensure Calculation Group exists
// -------------------------------------------------------
CalculationGroupTable cg = GetCalcGroup("Trend View");
if(cg == null)
{
    cg = Model.AddCalculationGroup("Trend View");
}

cg.Description = "Switches selected measures between current, previous, delta, delta %, and rolling 3 average views.";
cg.Precedence = 20;

if(cg.Columns.Count > 0)
{
    cg.Columns[0].Name = "Trend View";
    cg.Columns[0].Description = "Trend calculation selector";
}

// -------------------------------------------------------
// Measure mappings for calc group
// -------------------------------------------------------
var currentToPrevious = new Dictionary<string, string>();
var currentToDelta = new Dictionary<string, string>();
var currentToDeltaPct = new Dictionary<string, string>();
var currentToRolling3 = new Dictionary<string, string>();

// Lipid
currentToPrevious.Add("[Lipid Latest Total Cholesterol]", "[Lipid Previous Total Cholesterol]");
currentToPrevious.Add("[Lipid Latest HDL]", "[Lipid Previous HDL]");
currentToPrevious.Add("[Lipid Latest LDL Final]", "[Lipid Previous LDL Final]");
currentToPrevious.Add("[Lipid Latest TG]", "[Lipid Previous TG]");
currentToPrevious.Add("[Lipid Latest Non-HDL]", "[Lipid Previous Non-HDL]");
currentToPrevious.Add("[Lipid Latest TC/HDL]", "[Lipid Previous TC/HDL]");
currentToPrevious.Add("[Lipid Latest LDL/HDL]", "[Lipid Previous LDL/HDL]");
currentToPrevious.Add("[Lipid Latest TG/HDL]", "[Lipid Previous TG/HDL]");
currentToPrevious.Add("[Lipid Latest AIP]", "[Lipid Previous AIP]");
currentToPrevious.Add("[Lipid Latest Remnant]", "[Lipid Previous Remnant]");
currentToPrevious.Add("[Lipid Latest Lp(a)]", "[Lipid Previous Lp(a)]");

currentToDelta.Add("[Lipid Latest Total Cholesterol]", "[Lipid Total Cholesterol Delta]");
currentToDelta.Add("[Lipid Latest HDL]", "[Lipid HDL Delta]");
currentToDelta.Add("[Lipid Latest LDL Final]", "[Lipid LDL Final Delta]");
currentToDelta.Add("[Lipid Latest TG]", "[Lipid TG Delta]");
currentToDelta.Add("[Lipid Latest Non-HDL]", "[Lipid Non-HDL Delta]");
currentToDelta.Add("[Lipid Latest TC/HDL]", "[Lipid TC/HDL Delta]");
currentToDelta.Add("[Lipid Latest LDL/HDL]", "[Lipid LDL/HDL Delta]");
currentToDelta.Add("[Lipid Latest TG/HDL]", "[Lipid TG/HDL Delta]");
currentToDelta.Add("[Lipid Latest AIP]", "[Lipid AIP Delta]");
currentToDelta.Add("[Lipid Latest Remnant]", "[Lipid Remnant Delta]");
currentToDelta.Add("[Lipid Latest Lp(a)]", "[Lipid Lp(a) Delta]");

currentToDeltaPct.Add("[Lipid Latest Total Cholesterol]", "[Lipid Total Cholesterol Delta %]");
currentToDeltaPct.Add("[Lipid Latest HDL]", "[Lipid HDL Delta %]");
currentToDeltaPct.Add("[Lipid Latest LDL Final]", "[Lipid LDL Final Delta %]");
currentToDeltaPct.Add("[Lipid Latest TG]", "[Lipid TG Delta %]");
currentToDeltaPct.Add("[Lipid Latest Non-HDL]", "[Lipid Non-HDL Delta %]");
currentToDeltaPct.Add("[Lipid Latest TC/HDL]", "[Lipid TC/HDL Delta %]");
currentToDeltaPct.Add("[Lipid Latest LDL/HDL]", "[Lipid LDL/HDL Delta %]");
currentToDeltaPct.Add("[Lipid Latest TG/HDL]", "[Lipid TG/HDL Delta %]");
currentToDeltaPct.Add("[Lipid Latest AIP]", "[Lipid AIP Delta %]");
currentToDeltaPct.Add("[Lipid Latest Remnant]", "[Lipid Remnant Delta %]");
currentToDeltaPct.Add("[Lipid Latest Lp(a)]", "[Lipid Lp(a) Delta %]");

currentToRolling3.Add("[Lipid Latest Total Cholesterol]", "[Lipid Total Cholesterol Rolling 3]");
currentToRolling3.Add("[Lipid Latest HDL]", "[Lipid HDL Rolling 3]");
currentToRolling3.Add("[Lipid Latest LDL Final]", "[Lipid LDL Final Rolling 3]");
currentToRolling3.Add("[Lipid Latest TG]", "[Lipid TG Rolling 3]");
currentToRolling3.Add("[Lipid Latest Non-HDL]", "[Lipid Non-HDL Rolling 3]");
currentToRolling3.Add("[Lipid Latest AIP]", "[Lipid AIP Rolling 3]");
currentToRolling3.Add("[Lipid Latest TG/HDL]", "[Lipid TG/HDL Rolling 3]");
currentToRolling3.Add("[Lipid Latest Remnant]", "[Lipid Remnant Rolling 3]");

// Endo
currentToPrevious.Add("[Endo Latest Glucose]", "[Endo Previous Glucose]");
currentToPrevious.Add("[Endo Latest Fasting Insulin]", "[Endo Previous Fasting Insulin]");
currentToPrevious.Add("[Endo Latest HbA1c]", "[Endo Previous HbA1c]");
currentToPrevious.Add("[Endo Latest eAG]", "[Endo Previous eAG]");
currentToPrevious.Add("[Endo Latest HOMA-IR]", "[Endo Previous HOMA-IR]");
currentToPrevious.Add("[Endo Latest QUICKI]", "[Endo Previous QUICKI]");
currentToPrevious.Add("[Endo Latest TSH]", "[Endo Previous TSH]");
currentToPrevious.Add("[Endo Latest Free T4]", "[Endo Previous Free T4]");
currentToPrevious.Add("[Endo Latest TSH/Free T4 Ratio]", "[Endo Previous TSH/Free T4 Ratio]");
currentToPrevious.Add("[Endo Latest Vitamin D]", "[Endo Previous Vitamin D]");

currentToDelta.Add("[Endo Latest Glucose]", "[Endo Glucose Delta]");
currentToDelta.Add("[Endo Latest Fasting Insulin]", "[Endo Fasting Insulin Delta]");
currentToDelta.Add("[Endo Latest HbA1c]", "[Endo HbA1c Delta]");
currentToDelta.Add("[Endo Latest eAG]", "[Endo eAG Delta]");
currentToDelta.Add("[Endo Latest HOMA-IR]", "[Endo HOMA-IR Delta]");
currentToDelta.Add("[Endo Latest QUICKI]", "[Endo QUICKI Delta]");
currentToDelta.Add("[Endo Latest TSH]", "[Endo TSH Delta]");
currentToDelta.Add("[Endo Latest Free T4]", "[Endo Free T4 Delta]");
currentToDelta.Add("[Endo Latest TSH/Free T4 Ratio]", "[Endo TSH/Free T4 Ratio Delta]");
currentToDelta.Add("[Endo Latest Vitamin D]", "[Endo Vitamin D Delta]");

currentToDeltaPct.Add("[Endo Latest Glucose]", "[Endo Glucose Delta %]");
currentToDeltaPct.Add("[Endo Latest Fasting Insulin]", "[Endo Fasting Insulin Delta %]");
currentToDeltaPct.Add("[Endo Latest HbA1c]", "[Endo HbA1c Delta %]");
currentToDeltaPct.Add("[Endo Latest eAG]", "[Endo eAG Delta %]");
currentToDeltaPct.Add("[Endo Latest HOMA-IR]", "[Endo HOMA-IR Delta %]");
currentToDeltaPct.Add("[Endo Latest QUICKI]", "[Endo QUICKI Delta %]");
currentToDeltaPct.Add("[Endo Latest TSH]", "[Endo TSH Delta %]");
currentToDeltaPct.Add("[Endo Latest Free T4]", "[Endo Free T4 Delta %]");
currentToDeltaPct.Add("[Endo Latest TSH/Free T4 Ratio]", "[Endo TSH/Free T4 Ratio Delta %]");
currentToDeltaPct.Add("[Endo Latest Vitamin D]", "[Endo Vitamin D Delta %]");

currentToRolling3.Add("[Endo Latest Glucose]", "[Endo Glucose Rolling 3]");
currentToRolling3.Add("[Endo Latest Fasting Insulin]", "[Endo Fasting Insulin Rolling 3]");
currentToRolling3.Add("[Endo Latest HbA1c]", "[Endo HbA1c Rolling 3]");
currentToRolling3.Add("[Endo Latest eAG]", "[Endo eAG Rolling 3]");
currentToRolling3.Add("[Endo Latest HOMA-IR]", "[Endo HOMA-IR Rolling 3]");
currentToRolling3.Add("[Endo Latest QUICKI]", "[Endo QUICKI Rolling 3]");
currentToRolling3.Add("[Endo Latest TSH]", "[Endo TSH Rolling 3]");
currentToRolling3.Add("[Endo Latest Free T4]", "[Endo Free T4 Rolling 3]");
currentToRolling3.Add("[Endo Latest TSH/Free T4 Ratio]", "[Endo TSH/Free T4 Ratio Rolling 3]");
currentToRolling3.Add("[Endo Latest Vitamin D]", "[Endo Vitamin D Rolling 3]");

string BuildCalcSwitch(Dictionary<string, string> map, string fallback)
{
    var lines = new List<string>();
    lines.Add("SWITCH(TRUE(),");

    foreach(var kvp in map)
    {
        lines.Add("    ISSELECTEDMEASURE(" + kvp.Key + "), " + kvp.Value + ",");
    }

    lines.Add("    " + fallback);
    lines.Add(")");

    return string.Join(Environment.NewLine, lines.ToArray());
}

// Calculation items
AddOrReplaceCalcItem(
    cg,
    "Current",
    "SELECTEDMEASURE()",
    "SELECTEDMEASUREFORMATSTRING()",
    "Shows the selected measure as-is."
);

AddOrReplaceCalcItem(
    cg,
    "Previous",
    BuildCalcSwitch(currentToPrevious, "SELECTEDMEASURE()"),
    "SELECTEDMEASUREFORMATSTRING()",
    "Shows previous value for supported latest measures."
);

AddOrReplaceCalcItem(
    cg,
    "Delta",
    BuildCalcSwitch(currentToDelta, "SELECTEDMEASURE()"),
    "SELECTEDMEASUREFORMATSTRING()",
    "Shows delta for supported latest measures."
);

AddOrReplaceCalcItem(
    cg,
    "Delta %",
    BuildCalcSwitch(currentToDeltaPct, "SELECTEDMEASURE()"),
    "\"0.00%;-0.00%;0.00%\"",
    "Shows delta percent for supported latest measures."
);

AddOrReplaceCalcItem(
    cg,
    "Rolling 3 Avg",
    BuildCalcSwitch(currentToRolling3, "SELECTEDMEASURE()"),
    "SELECTEDMEASUREFORMATSTRING()",
    "Shows rolling 3 average for supported latest measures."
);

// KPI Color measures
AddOrReplaceMeasure(lipidTable, "Color - Good", "\"#2E7D32\"", "Formatting - Colors");
AddOrReplaceMeasure(lipidTable, "Color - Warning", "\"#F9A825\"", "Formatting - Colors");
AddOrReplaceMeasure(lipidTable, "Color - Elevated", "\"#EF6C00\"", "Formatting - Colors");
AddOrReplaceMeasure(lipidTable, "Color - Bad", "\"#C62828\"", "Formatting - Colors");

AddOrReplaceMeasure(
    lipidTable,
    "Lipid AIP Color Hex",
    @"
SWITCH(
    [Lipid AIP Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Lipid"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid TG/HDL Color Hex",
    @"
SWITCH(
    [Lipid TG/HDL Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#EF6C00"",
    4, ""#C62828"",
    BLANK()
)",
    "Formatting - Lipid"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Remnant Color Hex",
    @"
SWITCH(
    [Lipid Remnant Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Lipid"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid TC/HDL Color Hex",
    @"
SWITCH(
    [Lipid TC/HDL Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Lipid"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid LDL/HDL Color Hex",
    @"
SWITCH(
    [Lipid LDL/HDL Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Lipid"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Non-HDL Color Hex",
    @"
SWITCH(
    [Lipid Non-HDL Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#EF6C00"",
    4, ""#C62828"",
    BLANK()
)",
    "Formatting - Lipid"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid Composite Background Hex",
    "[Lipid Composite Color Hex]",
    "Formatting - Lipid"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo HOMA-IR Color Hex",
    @"
SWITCH(
    [Endo HOMA-IR Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Endo"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo QUICKI Color Hex",
    @"
SWITCH(
    [Endo QUICKI Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Endo"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Vitamin D Color Hex",
    @"
SWITCH(
    [Endo Vitamin D Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Endo"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo HbA1c Color Hex",
    @"
SWITCH(
    [Endo HbA1c Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Endo"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo Glucose Color Hex",
    @"
SWITCH(
    [Endo Glucose Score],
    1, ""#2E7D32"",
    2, ""#F9A825"",
    3, ""#C62828"",
    BLANK()
)",
    "Formatting - Endo"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid AIP Trend Color Hex",
    @"
SWITCH(
    [Lipid AIP Trend Direction],
    ""Improving"", ""#2E7D32"",
    ""Worsening"", ""#C62828"",
    ""Stable"", ""#9E9E9E"",
    BLANK()
)",
    "Formatting - Trend"
);

AddOrReplaceMeasure(
    lipidTable,
    "Lipid TG/HDL Trend Color Hex",
    @"
SWITCH(
    [Lipid TG/HDL Trend Direction],
    ""Improving"", ""#2E7D32"",
    ""Worsening"", ""#C62828"",
    ""Stable"", ""#9E9E9E"",
    BLANK()
)",
    "Formatting - Trend"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo HOMA-IR Trend Color Hex",
    @"
SWITCH(
    [Endo HOMA-IR Trend Direction],
    ""Improving"", ""#2E7D32"",
    ""Worsening"", ""#C62828"",
    ""Stable"", ""#9E9E9E"",
    BLANK()
)",
    "Formatting - Trend"
);

AddOrReplaceMeasure(
    endoTable,
    "Endo QUICKI Trend Color Hex",
    @"
SWITCH(
    [Endo QUICKI Trend Direction],
    ""Improving"", ""#2E7D32"",
    ""Worsening"", ""#C62828"",
    ""Stable"", ""#9E9E9E"",
    BLANK()
)",
    "Formatting - Trend"
);

AddOrReplaceMeasure(
    lipidTable,
    "Combined KPI Background Hex",
    "[Combined Metabolic Color Hex]",
    "Formatting - Combined"
);

AddOrReplaceMeasure(
    lipidTable,
    "Combined KPI Status Color Hex",
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
    "Formatting - Combined"
);

Info("TE2-safe calculation group and KPI color measures created/updated successfully.");