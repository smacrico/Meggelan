
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def save_time_series_plot(df: pd.DataFrame, date_col: str, value_col: str, title: str, out_path: Path) -> None:
    subset = df[[date_col, value_col]].dropna().copy()
    if subset.empty:
        return

    subset[date_col] = pd.to_datetime(subset[date_col])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(subset[date_col], subset[value_col], marker="o")
    ax.set_title(title)
    ax.set_xlabel("Exam Date")
    ax.set_ylabel(title)
    ax.grid(True, alpha=0.3)
    fig.autofmt_xdate()
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
