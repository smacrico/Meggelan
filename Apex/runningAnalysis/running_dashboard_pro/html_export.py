
from __future__ import annotations

from pathlib import Path
from datetime import datetime

import pandas as pd
import plotly.io as pio


def build_dashboard_html(
    output_dir: str | Path,
    title: str,
    kpis: dict,
    figures: dict,
    tables: dict,
    notes: list[str] | None = None,
) -> Path:
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = output_dir / f"running_dashboard_{timestamp}.html"

    css = '''
    <style>
        body { font-family: Arial, sans-serif; margin: 24px; background: #fafafa; color: #222; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .kpi { background: white; border: 1px solid #ddd; border-radius: 10px; padding: 14px; }
        .kpi .label { color: #666; font-size: 12px; margin-bottom: 6px; }
        .kpi .value { font-size: 26px; font-weight: bold; }
        .section { margin-top: 28px; }
        .table-wrap { background: white; border: 1px solid #ddd; border-radius: 10px; padding: 12px; overflow-x: auto; }
        h1, h2 { margin-bottom: 8px; }
        .note { background: #fff8d6; border: 1px solid #eedc82; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
    </style>
    '''

    parts = [f"<html><head><meta charset='utf-8'><title>{title}</title>{css}</head><body>"]
    parts.append(f"<h1>{title}</h1>")

    if notes:
        for note in notes:
            parts.append(f"<div class='note'>{note}</div>")

    parts.append("<div class='kpi-grid'>")
    for label, value in kpis.items():
        parts.append(f"<div class='kpi'><div class='label'>{label}</div><div class='value'>{value}</div></div>")
    parts.append("</div>")

    for section_title, fig in figures.items():
        parts.append(f"<div class='section'><h2>{section_title}</h2>")
        parts.append(pio.to_html(fig, include_plotlyjs='cdn', full_html=False))
        parts.append("</div>")

    for table_title, df in tables.items():
        parts.append(f"<div class='section'><h2>{table_title}</h2><div class='table-wrap'>")
        if isinstance(df, pd.DataFrame):
            parts.append(df.to_html(index=False, border=0))
        else:
            parts.append(str(df))
        parts.append("</div></div>")

    parts.append("</body></html>")
    out_path.write_text("".join(parts), encoding="utf-8")
    return out_path
