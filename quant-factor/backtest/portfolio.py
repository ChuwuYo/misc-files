"""Portfolio construction utilities for cross-market ensemble (v0.19+).

Convert a (date × symbol) factor signal into a daily PnL stream by:
1. Cross-sectional rank → quintile assignment per date
2. Long top quintile, short bottom quintile, equal-weighted within
3. PnL = sum(forward_return × position) at each date

Then ensemble multiple markets at portfolio level.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def factor_to_pnl(
    factor: pd.DataFrame,
    close: pd.DataFrame,
    n_quantiles: int = 5,
    horizon: int = 1,
) -> pd.Series:
    """Convert wide factor → daily PnL via top-minus-bottom quintile portfolio.

    Each date:
        - rank symbols by factor → assign to n_quantiles
        - position = +1 if top quintile, -1 if bottom, 0 otherwise
        - PnL[t] = mean(position × forward_return)
    Returns: pd.Series indexed by date.
    """
    fwd = close.shift(-horizon) / close - 1.0
    f, r = factor.align(fwd, join="inner")

    qs = f.apply(
        lambda row: pd.qcut(row, n_quantiles, labels=False, duplicates="drop"),
        axis=1,
    )
    top = qs == (n_quantiles - 1)
    bot = qs == 0
    top_n = top.sum(axis=1).replace(0, np.nan)
    bot_n = bot.sum(axis=1).replace(0, np.nan)
    long_pnl = (r.where(top).sum(axis=1) / top_n)
    short_pnl = (r.where(bot).sum(axis=1) / bot_n)
    return (long_pnl - short_pnl).dropna()


def sharpe(pnl: pd.Series, periods_per_year: int = 252) -> float:
    """Annualized Sharpe assuming periods_per_year periods (252 for trading days)."""
    pnl = pnl.dropna()
    if len(pnl) < 5 or pnl.std() == 0:
        return float("nan")
    return float(pnl.mean() / pnl.std() * np.sqrt(periods_per_year))


def portfolio_summary(pnl: pd.Series, periods_per_year: int = 252) -> dict:
    pnl = pnl.dropna()
    if len(pnl) == 0:
        return {}
    ann_ret = (1 + pnl.mean()) ** periods_per_year - 1
    ann_vol = pnl.std() * np.sqrt(periods_per_year)
    sr = ann_ret / ann_vol if ann_vol > 0 else float("nan")
    cum = (1 + pnl).cumprod()
    dd = (cum / cum.cummax() - 1).min()
    return dict(
        n_periods=len(pnl),
        ann_return=ann_ret,
        ann_vol=ann_vol,
        sharpe=sr,
        max_drawdown=float(dd),
        win_rate=float((pnl > 0).mean()),
    )


def ensemble_pnl(
    pnl_streams: dict[str, pd.Series],
    weights: dict[str, float] | None = None,
) -> pd.Series:
    """Combine per-market PnL series into a single portfolio stream.

    weights default to equal across markets. NaN is treated as 0 PnL
    (market not trading that day, e.g. crypto on a US holiday).
    """
    if not pnl_streams:
        raise ValueError("pnl_streams must not be empty")
    if weights is None:
        weights = {k: 1.0 / len(pnl_streams) for k in pnl_streams}
    df = pd.concat(pnl_streams, axis=1).fillna(0)
    out = sum(df[k] * w for k, w in weights.items())
    return out
