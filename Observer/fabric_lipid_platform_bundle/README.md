# Microsoft Fabric Lipid Blood Test Medallion Platform

This bundle contains implementation templates for an end-to-end Microsoft Fabric data platform foundation for `Lipid_Derived_Markers_Trends_March2026.xlsx`.

## Artifacts

- `01_bronze_ingest_from_xlsx.py` — Fabric notebook template to parse the raw Excel workbook from Bronze Lakehouse Files into raw Bronze Delta tables with ingestion metadata.
- `02_silver_transform.py` — Fabric notebook template to cleanse and conform raw lipid data into a Silver Delta table.
- `03_gold_star_schema.sql` — Spark SQL script to create Gold star-schema tables.
- `semantic_model_measures.dax` — Suggested DAX measures for the Power BI semantic model.
- `pipeline-content.json` — Fabric Data Factory pipeline-content template with Copy, Notebook, Notebook, and semantic-model refresh activities.

Replace all placeholders of the form `<...>` with your Fabric workspace, item, notebook, connection, and semantic model IDs.
