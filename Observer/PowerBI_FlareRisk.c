// Tabular Editor Advanced Script
// Creates/updates a measure table called: measures_ms

string measureTableName = "measures_ms";
string fallbackPartitionName = "p_measures_ms";

// Create measure table if it does not exist
var measureTable = Model.Tables.FirstOrDefault(t => t.Name == measureTableName);

if (measureTable == null)
{
    measureTable = Model.AddTable(measureTableName);

    // Add a dummy column so the table exists structurally
    var col = measureTable.AddDataColumn("Measure Holder", DataType.String);
    col.IsHidden = true;

    // Add a minimal partition
    measureTable.AddPartition(
        fallbackPartitionName,
        PartitionSourceType.Calculated,
        "DATATABLE(\"Measure Holder\", STRING, {{\"MS\"}})"
    );

    measureTable.IsHidden = true;
}

// Helper to add or update a measure
void AddOrUpdateMeasure(string name, string expression, string displayFolder = "MS Risk")
{
    var m = measureTable.Measures.FirstOrDefault(x => x.Name == name);
    if (m == null)
    {
        m = measureTable.AddMeasure(name, expression);
    }
    else
    {
        m.Expression = expression;
    }

    m.DisplayFolder = displayFolder;
    m.FormatString = "General";
}

// ----------------------
// Core measures
// ----------------------

AddOrUpdateMeasure(
    "MS Risk Prediction Count",
    @"COUNTROWS('vw_ms_risk_predictions')",
    "MS Risk\\Core"
);

AddOrUpdateMeasure(
    "Latest MS Flare Risk Score",
    @"MAX('vw_ms_risk_latest_by_source'[overall_risk_score])",
    "MS Risk\\Core"
);

AddOrUpdateMeasure(
    "Latest MS Flare Risk Level",
    @"SELECTEDVALUE('vw_ms_risk_latest_by_source'[risk_level])",
    "MS Risk\\Core"
);

AddOrUpdateMeasure(
    "Latest MS Flare Prediction Timestamp",
    @"MAX('vw_ms_risk_latest_by_source'[prediction_timestamp])",
    "MS Risk\\Core"
);

// ----------------------
// Latest components
// ----------------------

AddOrUpdateMeasure(
    "Latest HRV Risk Component",
    @"MAX('vw_ms_risk_latest_by_source'[hrv_component])",
    "MS Risk\\Latest Components"
);

AddOrUpdateMeasure(
    "Latest Trend Risk Component",
    @"MAX('vw_ms_risk_latest_by_source'[trend_component])",
    "MS Risk\\Latest Components"
);

AddOrUpdateMeasure(
    "Latest Alert Risk Component",
    @"MAX('vw_ms_risk_latest_by_source'[alert_component])",
    "MS Risk\\Latest Components"
);

AddOrUpdateMeasure(
    "Latest Anomaly Risk Component",
    @"MAX('vw_ms_risk_latest_by_source'[anomaly_component])",
    "MS Risk\\Latest Components"
);

AddOrUpdateMeasure(
    "Latest Symptom Risk Component",
    @"MAX('vw_ms_risk_latest_by_source'[symptom_component])",
    "MS Risk\\Latest Components"
);

AddOrUpdateMeasure(
    "Latest Medication Risk Component",
    @"MAX('vw_ms_risk_latest_by_source'[medication_component])",
    "MS Risk\\Latest Components"
);

// ----------------------
// Historical summary
// ----------------------

AddOrUpdateMeasure(
    "Average MS Flare Risk Score",
    @"AVERAGE('vw_ms_risk_predictions'[overall_risk_score])",
    "MS Risk\\History"
);

AddOrUpdateMeasure(
    "Max MS Flare Risk Score",
    @"MAX('vw_ms_risk_predictions'[overall_risk_score])",
    "MS Risk\\History"
);

AddOrUpdateMeasure(
    "Min MS Flare Risk Score",
    @"MIN('vw_ms_risk_predictions'[overall_risk_score])",
    "MS Risk\\History"
);

// ----------------------
// Rolling averages
// ----------------------

AddOrUpdateMeasure(
    "MS Flare Risk 7D Avg",
    @"
AVERAGEX(
    DATESINPERIOD(
        'vw_dim_date'[date_key],
        MAX('vw_dim_date'[date_key]),
        -7,
        DAY
    ),
    CALCULATE(AVERAGE('vw_ms_risk_predictions'[overall_risk_score]))
)",
    "MS Risk\\Rolling"
);

AddOrUpdateMeasure(
    "MS Flare Risk 30D Avg",
    @"
AVERAGEX(
    DATESINPERIOD(
        'vw_dim_date'[date_key],
        MAX('vw_dim_date'[date_key]),
        -30,
        DAY
    ),
    CALCULATE(AVERAGE('vw_ms_risk_predictions'[overall_risk_score]))
)",
    "MS Risk\\Rolling"
);

// ----------------------
// Flags and bands
// ----------------------

AddOrUpdateMeasure(
    "MS Risk Is Low",
    @"IF([Latest MS Flare Risk Score] <= 0.30, 1, 0)",
    "MS Risk\\Flags"
);

AddOrUpdateMeasure(
    "MS Risk Is Moderate",
    @"
IF(
    [Latest MS Flare Risk Score] > 0.30 &&
    [Latest MS Flare Risk Score] <= 0.60,
    1,
    0
)",
    "MS Risk\\Flags"
);

AddOrUpdateMeasure(
    "MS Risk Is High",
    @"
IF(
    [Latest MS Flare Risk Score] > 0.60 &&
    [Latest MS Flare Risk Score] <= 0.80,
    1,
    0
)",
    "MS Risk\\Flags"
);

AddOrUpdateMeasure(
    "MS Risk Is Critical",
    @"IF([Latest MS Flare Risk Score] > 0.80, 1, 0)",
    "MS Risk\\Flags"
);

AddOrUpdateMeasure(
    "MS Risk Severity Band",
    @"
SWITCH(
    TRUE(),
    [Latest MS Flare Risk Score] <= 0.30, 1,
    [Latest MS Flare Risk Score] <= 0.60, 2,
    [Latest MS Flare Risk Score] <= 0.80, 3,
    4
)",
    "MS Risk\\Flags"
);

AddOrUpdateMeasure(
    "MS Risk Level Label",
    @"
SWITCH(
    TRUE(),
    [Latest MS Flare Risk Score] <= 0.30, ""LOW"",
    [Latest MS Flare Risk Score] <= 0.60, ""MODERATE"",
    [Latest MS Flare Risk Score] <= 0.80, ""HIGH"",
    ""CRITICAL""
)",
    "MS Risk\\Flags"
);

// ----------------------
// Text measures
// ----------------------

AddOrUpdateMeasure(
    "Latest MS Risk Recommendations",
    @"SELECTEDVALUE('vw_ms_risk_latest_by_source'[recommendations])",
    "MS Risk\\Text"
);

AddOrUpdateMeasure(
    "Latest MS Risk Data Quality Notes",
    @"SELECTEDVALUE('vw_ms_risk_latest_by_source'[data_quality_notes])",
    "MS Risk\\Text"
);

// ----------------------
// Average components
// ----------------------

AddOrUpdateMeasure(
    "Avg HRV Risk Component",
    @"AVERAGE('vw_ms_risk_predictions'[hrv_component])",
    "MS Risk\\Average Components"
);

AddOrUpdateMeasure(
    "Avg Trend Risk Component",
    @"AVERAGE('vw_ms_risk_predictions'[trend_component])",
    "MS Risk\\Average Components"
);

AddOrUpdateMeasure(
    "Avg Alert Risk Component",
    @"AVERAGE('vw_ms_risk_predictions'[alert_component])",
    "MS Risk\\Average Components"
);

AddOrUpdateMeasure(
    "Avg Anomaly Risk Component",
    @"AVERAGE('vw_ms_risk_predictions'[anomaly_component])",
    "MS Risk\\Average Components"
);

AddOrUpdateMeasure(
    "Avg Symptom Risk Component",
    @"AVERAGE('vw_ms_risk_predictions'[symptom_component])",
    "MS Risk\\Average Components"
);

AddOrUpdateMeasure(
    "Avg Medication Risk Component",
    @"AVERAGE('vw_ms_risk_predictions'[medication_component])",
    "MS Risk\\Average Components"
);

// ----------------------
// Delta measures
// ----------------------

AddOrUpdateMeasure(
    "MS Risk Score Delta vs 7D Avg",
    @"[Latest MS Flare Risk Score] - [MS Flare Risk 7D Avg]",
    "MS Risk\\Delta"
);

AddOrUpdateMeasure(
    "MS Risk Score Delta vs 30D Avg",
    @"[Latest MS Flare Risk Score] - [MS Flare Risk 30D Avg]",
    "MS Risk\\Delta"
);

AddOrUpdateMeasure(
    "MS Risk Above 7D Avg Flag",
    @"IF([MS Risk Score Delta vs 7D Avg] > 0, 1, 0)",
    "MS Risk\\Delta"
);

AddOrUpdateMeasure(
    "MS Risk Above 30D Avg Flag",
    @"IF([MS Risk Score Delta vs 30D Avg] > 0, 1, 0)",
    "MS Risk\\Delta"
);

// ----------------------
// Totals
// ----------------------

AddOrUpdateMeasure(
    "MS Risk Component Total Latest",
    @"
[Latest HRV Risk Component] +
[Latest Trend Risk Component] +
[Latest Alert Risk Component] +
[Latest Anomaly Risk Component] +
[Latest Symptom Risk Component] +
[Latest Medication Risk Component]
",
    "MS Risk\\Totals"
);

AddOrUpdateMeasure(
    "MS Risk Component Total Avg",
    @"
[Avg HRV Risk Component] +
[Avg Trend Risk Component] +
[Avg Alert Risk Component] +
[Avg Anomaly Risk Component] +
[Avg Symptom Risk Component] +
[Avg Medication Risk Component]
",
    "MS Risk\\Totals"
);

// Optional formatting
foreach (var m in measureTable.Measures)
{
    if (
        m.Name.Contains("Score") ||
        m.Name.Contains("Component") ||
        m.Name.Contains("Avg") ||
        m.Name.Contains("Delta")
    )
    {
        m.FormatString = "0.000";
    }

    if (
        m.Name.Contains("Count") ||
        m.Name.Contains("Band") ||
        m.Name.Contains("Flag")
    )
    {
        m.FormatString = "0";
    }
}

Info("Measures created/updated in table: " + measureTableName);