// Tabular Editor Advanced Scripting
// Safe for Power BI Desktop / PBIP
// Creates a calculated table for measures if it doesn't exist,
// then adds or updates the requested measures.

string measureTableName = "Measures";

// Get existing table
var measureTable = Model.Tables.FirstOrDefault(t => t.Name == measureTableName);

// Create as CALCULATED TABLE if it doesn't exist
if (measureTable == null)
{
    measureTable = Model.AddCalculatedTable(measureTableName, "ROW(\"Dummy\", 1)");
    measureTable.IsHidden = false;

    var dummyColumn = measureTable.Columns.FirstOrDefault(c => c.Name == "Dummy");
    if (dummyColumn != null)
        dummyColumn.IsHidden = true;
}

// Helper to create or update a measure
void AddOrUpdateMeasure(string name, string expression, string formatString = null, string displayFolder = null)
{
    var measure = measureTable.Measures.FirstOrDefault(m => m.Name == name);

    if (measure == null)
        measure = measureTable.AddMeasure(name, expression);
    else
        measure.Expression = expression;

    if (!string.IsNullOrEmpty(formatString))
        measure.FormatString = formatString;

    if (!string.IsNullOrEmpty(displayFolder))
        measure.DisplayFolder = displayFolder;
}

// Counts
AddOrUpdateMeasure("Measurement Count", "COUNTROWS('vw_fact_measurements')", "#,0", "Counts");
AddOrUpdateMeasure("Alert Count", "COUNTROWS('vw_fact_alerts')", "#,0", "Counts");
AddOrUpdateMeasure("Anomaly Count", "COUNTROWS('vw_fact_anomalies')", "#,0", "Counts");

// Dates
AddOrUpdateMeasure("Latest Measurement Date", "MAX('vw_fact_measurements'[measurement_date])", "yyyy-mm-dd", "Dates");

// Averages
AddOrUpdateMeasure("Avg RMSSD", "AVERAGE('vw_fact_measurements'[rmssd])", "0.00", "Averages");
AddOrUpdateMeasure("Avg SDNN", "AVERAGE('vw_fact_measurements'[sdnn])", "0.00", "Averages");
AddOrUpdateMeasure("Avg HF", "AVERAGE('vw_fact_measurements'[HF])", "0.00", "Averages");
AddOrUpdateMeasure("Avg LF", "AVERAGE('vw_fact_measurements'[LF])", "0.00", "Averages");

// Current
AddOrUpdateMeasure("Latest MS Score", "MAX('vw_latest_trends_by_source_metric'[latest_ms_score])", "0.00", "Current");

AddOrUpdateMeasure(
    "Latest Metric Value",
    @"VAR LastDate = MAX('vw_long_measurements'[measurement_date])
RETURN
CALCULATE(
    AVERAGE('vw_long_measurements'[value]),
    'vw_long_measurements'[measurement_date] = LastDate
)",
    "0.00",
    "Current"
);

// Baseline
AddOrUpdateMeasure(
    "Baseline Avg",
    @"VAR m = SELECTEDVALUE('vw_long_measurements'[metric])
RETURN
SWITCH(
    TRUE(),
    m = ""SD1"", MAX('vw_latest_baseline_by_source'[avg_SD1]),
    m = ""SD2"", MAX('vw_latest_baseline_by_source'[avg_SD2]),
    m = ""sdnn"", MAX('vw_latest_baseline_by_source'[avg_sdnn]),
    m = ""rmssd"", MAX('vw_latest_baseline_by_source'[avg_rmssd]),
    m = ""pNN50"", MAX('vw_latest_baseline_by_source'[avg_pNN50]),
    m = ""VLF"", MAX('vw_latest_baseline_by_source'[avg_VLF]),
    m = ""LF"", MAX('vw_latest_baseline_by_source'[avg_LF]),
    m = ""HF"", MAX('vw_latest_baseline_by_source'[avg_HF]),
    BLANK()
)",
    "0.00",
    "Baseline"
);

AddOrUpdateMeasure(
    "Baseline Std",
    @"VAR m = SELECTEDVALUE('vw_long_measurements'[metric])
RETURN
SWITCH(
    TRUE(),
    m = ""SD1"", MAX('vw_latest_baseline_by_source'[std_SD1]),
    m = ""SD2"", MAX('vw_latest_baseline_by_source'[std_SD2]),
    m = ""sdnn"", MAX('vw_latest_baseline_by_source'[std_sdnn]),
    m = ""rmssd"", MAX('vw_latest_baseline_by_source'[std_rmssd]),
    m = ""pNN50"", MAX('vw_latest_baseline_by_source'[std_pNN50]),
    m = ""VLF"", MAX('vw_latest_baseline_by_source'[std_VLF]),
    m = ""LF"", MAX('vw_latest_baseline_by_source'[std_LF]),
    m = ""HF"", MAX('vw_latest_baseline_by_source'[std_HF]),
    BLANK()
)",
    "0.00",
    "Baseline"
);

AddOrUpdateMeasure("Deviation vs Baseline %", "DIVIDE([Latest Metric Value] - [Baseline Avg], [Baseline Avg])", "0.00%", "Baseline");
AddOrUpdateMeasure("Z Score vs Baseline", "DIVIDE([Latest Metric Value] - [Baseline Avg], [Baseline Std])", "0.00", "Baseline");

// Trend
AddOrUpdateMeasure("Trend Slope", "MAX('vw_latest_trends_by_source_metric'[slope])", "0.0000", "Trend");
AddOrUpdateMeasure("Trend R Value", "MAX('vw_latest_trends_by_source_metric'[r_value])", "0.0000", "Trend");
AddOrUpdateMeasure("Trend Direction", "SELECTEDVALUE('vw_latest_trends_by_source_metric'[trend_direction])", null, "Trend");
AddOrUpdateMeasure("Trend Strength", "SELECTEDVALUE('vw_latest_trends_by_source_metric'[trend_strength])", null, "Trend");

// Rolling 7D
AddOrUpdateMeasure(
    "RMSSD 7D Avg",
    @"AVERAGEX(
    DATESINPERIOD('vw_dim_date'[date_key], MAX('vw_dim_date'[date_key]), -7, DAY),
    CALCULATE(AVERAGE('vw_fact_measurements'[rmssd]))
)",
    "0.00",
    "Rolling 7D"
);

AddOrUpdateMeasure(
    "SDNN 7D Avg",
    @"AVERAGEX(
    DATESINPERIOD('vw_dim_date'[date_key], MAX('vw_dim_date'[date_key]), -7, DAY),
    CALCULATE(AVERAGE('vw_fact_measurements'[sdnn]))
)",
    "0.00",
    "Rolling 7D"
);

AddOrUpdateMeasure(
    "MS Score 7D Avg",
    @"AVERAGEX(
    DATESINPERIOD('vw_dim_date'[date_key], MAX('vw_dim_date'[date_key]), -7, DAY),
    CALCULATE(MAX('vw_latest_trends_by_source_metric'[latest_ms_score]))
)",
    "0.00",
    "Rolling 7D"
);

// Flags
AddOrUpdateMeasure("Has Alerts", @"IF([Alert Count] > 0, ""Yes"", ""No"")", null, "Flags");
AddOrUpdateMeasure("Has Anomalies", @"IF([Anomaly Count] > 0, ""Yes"", ""No"")", null, "Flags");

Info("Measures created/updated successfully in table: " + measureTableName);