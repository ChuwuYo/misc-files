"""Multi-timeframe support — resample OHLCV to any timeframe.

Designed to be exchange-agnostic: works for A-share daily, US intraday,
crypto 24/7, futures sessions. The base TF is the finest grain you have;
all other TFs are derived by aggregation.

Inspirations:
    - Qlib's freq-agnostic Handler
    - vnpy BarGenerator (incremental aggregation)
    - pandas resample idiom

Forward returns at TF X must use TF-X bars — never mix.
"""
from __future__ import annotations

from enum import Enum
from typing import Iterable

import numpy as np
import pandas as pd


class TimeFrame(str, Enum):
    M1 = "1min"
    M5 = "5min"
    M15 = "15min"
    M30 = "30min"
    H1 = "1h"
    H4 = "4h"
    D1 = "1D"
    W1 = "1W-FRI"
    MO1 = "1ME"

    @classmethod
    def all(cls) -> list["TimeFrame"]:
        return list(cls)

    @classmethod
    def short(cls) -> list["TimeFrame"]:
        return [cls.M1, cls.M5, cls.M15, cls.M30, cls.H1, cls.H4]

    @classmethod
    def long(cls) -> list["TimeFrame"]:
        return [cls.D1, cls.W1, cls.MO1]


# Approximate annualization factor per TF (assuming continuous markets like crypto;
# equity-specific factors live in the evaluator and override this).
ANNUALIZATION = {
    TimeFrame.M1: 525_600,
    TimeFrame.M5: 105_120,
    TimeFrame.M15: 35_040,
    TimeFrame.M30: 17_520,
    TimeFrame.H1: 8_760,
    TimeFrame.H4: 2_190,
    TimeFrame.D1: 252,    # equity convention
    TimeFrame.W1: 52,
    TimeFrame.MO1: 12,
}


# OHLCV aggregation rules — applied via pd.Grouper / resample.agg.
OHLCV_AGG = {
    "open": "first",
    "high": "max",
    "low": "min",
    "close": "last",
    "volume": "sum",
}


def resample_panel(panel: pd.DataFrame, tf: TimeFrame) -> pd.DataFrame:
    """Resample a long OHLCV panel (date, symbol, ohlcv) to target TF.

    Returns a long panel at the new TF.
    """
    if "date" not in panel.columns:
        raise ValueError("panel must have a 'date' column")
    panel = panel.copy()
    panel["date"] = pd.to_datetime(panel["date"])

    # Per-symbol resample then concat — preserves MultiIndex semantics.
    parts = []
    for sym, grp in panel.groupby("symbol", sort=False):
        g = grp.set_index("date").sort_index()
        agg_cols = {k: v for k, v in OHLCV_AGG.items() if k in g.columns}
        rs = g.resample(tf.value).agg(agg_cols)
        # `volume: sum` returns 0 for empty bins (not NaN), so a how='all' dropna
        # keeps weekend/holiday rows. Use close as the source-of-truth field.
        if "close" in rs.columns:
            rs = rs.dropna(subset=["close"])
        else:
            rs = rs.dropna(how="all")
        rs["symbol"] = sym
        rs = rs.reset_index()
        parts.append(rs)
    out = pd.concat(parts, ignore_index=True)
    cols = ["date", "symbol"] + [c for c in OHLCV_AGG if c in out.columns]
    return out[cols]


def to_wide(panel: pd.DataFrame, field: str = "close") -> pd.DataFrame:
    """Pivot long -> wide (date × symbol). Re-exported so callers can import here."""
    return (
        panel.pivot(index="date", columns="symbol", values=field)
        .sort_index()
        .astype("float64")
    )


def horizon_for_tf(tf: TimeFrame, days: float = 1.0) -> int:
    """Translate '~1 trading day forward' into bar count for given TF.

    Used by the evaluator to keep horizons comparable across TFs.
    """
    bars_per_day = {
        TimeFrame.M1: 240,   # A-share-ish; can be overridden
        TimeFrame.M5: 48,
        TimeFrame.M15: 16,
        TimeFrame.M30: 8,
        TimeFrame.H1: 4,
        TimeFrame.H4: 1,
        TimeFrame.D1: 1,
        TimeFrame.W1: 1,
        TimeFrame.MO1: 1,
    }
    return max(1, int(round(bars_per_day[tf] * days)))


def cross_tf_corr(signals_by_tf: dict[TimeFrame, pd.DataFrame]) -> pd.DataFrame:
    """Cross-TF signal correlation matrix (for redundancy checks).

    Each value: average per-date Pearson correlation between two TFs' signals,
    after aligning each to the coarser TF's index.
    """
    tfs = list(signals_by_tf.keys())
    out = pd.DataFrame(index=[t.name for t in tfs], columns=[t.name for t in tfs], dtype=float)
    for i, ti in enumerate(tfs):
        for j, tj in enumerate(tfs):
            if i == j:
                out.iloc[i, j] = 1.0
                continue
            si, sj = signals_by_tf[ti], signals_by_tf[tj]
            # Align on coarser TF index; forward-fill the finer one.
            common = si.index.union(sj.index).sort_values()
            si_a = si.reindex(common).ffill().reindex(sj.index)
            sj_a = sj
            si_a, sj_a = si_a.align(sj_a, join="inner", axis=1)
            corrs = []
            for t in si_a.index:
                a, b = si_a.loc[t], sj_a.loc[t]
                mask = a.notna() & b.notna()
                if mask.sum() > 5:
                    corrs.append(np.corrcoef(a[mask], b[mask])[0, 1])
            out.iloc[i, j] = float(np.mean(corrs)) if corrs else np.nan
    return out
