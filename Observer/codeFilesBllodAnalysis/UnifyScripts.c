// =======================================================
// Blood Analysis Platform - Measure Table Layout
// TE2-safe version
// Creates dedicated measure tables and moves measures
// =======================================================

using System;
using System.Linq;
using System.Collections.Generic;

string[] targetMeasureTables = new string[]
{
    "Measures - Common",
    "Measures - Lipid",
    "Measures - Endo",
    "Measures - Combined",
    "Measures - Formatting"
};

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
Table GetTableByName(string tableName)
{
    return Model.Tables.FirstOrDefault(t => t.Name == tableName);
}

Table EnsureMeasureTable(string tableName)
{
    var existing = GetTableByName(tableName);
    if(existing != null)
        return existing;

    var t = Model.AddTable(tableName);
    var c = t.AddDataColumn("Measure Holder", DataType.String);
    c.IsHidden = true;
    t.IsHidden = false;
    t.Description = "Dedicated display table for measures.";
    return t;
}

void EnsureMeasureTables()
{
    foreach(var tableName in targetMeasureTables)
    {
        EnsureMeasureTable(tableName);
    }
}

bool StartsWithAny(string input, params string[] prefixes)
{
    if(input == null) return false;

    foreach(var p in prefixes)
    {
        if(input.StartsWith(p, StringComparison.OrdinalIgnoreCase))
            return true;
    }
    return false;
}

bool ContainsAny(string input, params string[] parts)
{
    if(input == null) return false;

    foreach(var p in parts)
    {
        if(input.IndexOf(p, StringComparison.OrdinalIgnoreCase) >= 0)
            return true;
    }
    return false;
}

Table ResolveDestination(Measure m)
{
    string name = m.Name ?? "";
    string folder = m.DisplayFolder ?? "";

    if(
        StartsWithAny(name, "Latest Selected Date", "Previous Selected Date", "Test Count", "Days Between") ||
        StartsWithAny(folder, "_Common")
    )
        return GetTableByName("Measures - Common");

    if(
        StartsWithAny(name, "Combined ") ||
        StartsWithAny(folder, "Combined")
    )
        return GetTableByName("Measures - Combined");

    if(
        StartsWithAny(name, "Color ") ||
        ContainsAny(name, " Color Hex", " Background Hex", " Font Hex") ||
        StartsWithAny(folder, "Formatting")
    )
        return GetTableByName("Measures - Formatting");

    if(
        StartsWithAny(name, "Lipid ") ||
        StartsWithAny(folder, "Lipid")
    )
        return GetTableByName("Measures - Lipid");

    if(
        StartsWithAny(name, "Endo ") ||
        StartsWithAny(folder, "Endo")
    )
        return GetTableByName("Measures - Endo");

    return null;
}

void MoveMeasure(Measure m, Table destination)
{
    if(destination == null) return;
    if(m.Table.Name == destination.Name) return;

    m.Table = destination;
}

void NormalizeDisplayFolders()
{
    foreach(var t in Model.Tables)
    {
        foreach(var m in t.Measures)
        {
            if(m.Table.Name == "Measures - Common" && string.IsNullOrWhiteSpace(m.DisplayFolder))
                m.DisplayFolder = "_Common";

            if(m.Table.Name == "Measures - Lipid" && string.IsNullOrWhiteSpace(m.DisplayFolder))
                m.DisplayFolder = "Lipid";

            if(m.Table.Name == "Measures - Endo" && string.IsNullOrWhiteSpace(m.DisplayFolder))
                m.DisplayFolder = "Endo";

            if(m.Table.Name == "Measures - Combined" && string.IsNullOrWhiteSpace(m.DisplayFolder))
                m.DisplayFolder = "Combined";

            if(m.Table.Name == "Measures - Formatting" && string.IsNullOrWhiteSpace(m.DisplayFolder))
                m.DisplayFolder = "Formatting";
        }
    }
}

void SetDescriptions()
{
    GetTableByName("Measures - Common").Description = "Common reusable measures such as date context and test counts.";
    GetTableByName("Measures - Lipid").Description = "Lipidemic profile measures.";
    GetTableByName("Measures - Endo").Description = "Endocrinology profile measures.";
    GetTableByName("Measures - Combined").Description = "Cross-profile combined metabolic measures.";
    GetTableByName("Measures - Formatting").Description = "Conditional-formatting helper measures and color measures.";
}

// -------------------------------------------------------
// Execute
// -------------------------------------------------------
EnsureMeasureTables();
SetDescriptions();

var allMeasures = new List<Measure>();

foreach(var t in Model.Tables)
{
    foreach(var m in t.Measures)
    {
        allMeasures.Add(m);
    }
}

foreach(var m in allMeasures)
{
    if(m.Table is CalculationGroupTable)
        continue;

    var destination = ResolveDestination(m);
    if(destination != null)
    {
        MoveMeasure(m, destination);
    }
}

NormalizeDisplayFolders();

foreach(var tableName in targetMeasureTables)
{
    var t = GetTableByName(tableName);
    if(t == null) continue;

    foreach(var c in t.Columns)
    {
        c.IsHidden = true;
    }
}

Info("TE2-safe measure tables created and measures moved successfully.");