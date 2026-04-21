"""Cross-sectional neutralization — strip known risk factors (sector, size,
beta) from a wide factor so what remains is pure alpha.

References:
    - Barra USE3/CNE5 risk model — multi-factor regression neutralization
    - Fama-MacBeth (1973) — cross-sectional regression methodology
    - Asness/Frazzini (2013) "The Devil in HML's Details" — why this matters
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def sector_neutralize(factor: pd.DataFrame, sector_map: pd.Series) -> pd.DataFrame:
    """Per-row demean within each sector group.

    Mathematically equivalent to OLS regression of factor on one-hot sector
    dummies (no intercept) and taking residuals — but ~100x faster.

    Args:
        factor: wide DataFrame (date × symbol)
        sector_map: Series mapping symbol -> sector_label
    """
    # Restrict to symbols we have a sector for.
    common = factor.columns.intersection(sector_map.index)
    f = factor.loc[:, common]
    sec = sector_map.loc[common]

    out = f.copy()
    for sector_label, group in sec.groupby(sec):
        cols = group.index
        if len(cols) < 2:
            continue
        sub = f.loc[:, cols]
        out.loc[:, cols] = sub.sub(sub.mean(axis=1), axis=0)
    # Symbols not in sector_map: leave unchanged.
    if len(common) < len(factor.columns):
        missing = factor.columns.difference(common)
        out = out.join(factor.loc[:, missing])
        out = out.loc[:, factor.columns]
    return out


def size_neutralize(factor: pd.DataFrame, size_map: pd.Series) -> pd.DataFrame:
    """Per-row OLS residual of factor on log-size.

    For each date t: factor[t,s] = α[t] + β[t]*log_size[s] + ε[t,s]
    Output is ε.

    Vectorized: at each row solve a 2-param OLS in closed form.
    """
    common = factor.columns.intersection(size_map.index)
    f = factor.loc[:, common].to_numpy()
    log_size = np.log(size_map.loc[common].to_numpy(dtype=float))

    # Per-row demean of x = log_size
    x = log_size - log_size.mean()
    xx = (x * x).sum()
    if xx <= 0:
        return factor

    # f shape (T, N). x shape (N,). Per-row beta = sum(x*(f - f.mean)) / xx.
    f_mean = np.nanmean(f, axis=1, keepdims=True)
    fm = f - f_mean
    # Use NaN-safe sums: only count cells with finite value.
    mask = np.isfinite(fm)
    fm0 = np.where(mask, fm, 0)
    x_b = np.broadcast_to(x, fm0.shape)
    num = (x_b * fm0).sum(axis=1)
    # Denominator should also be NaN-aware: sum of x² over valid columns.
    den = np.where(mask, x_b * x_b, 0).sum(axis=1)
    den = np.where(den > 0, den, 1.0)
    beta = num / den
    resid = fm - beta[:, None] * x_b

    out = factor.copy()
    out.loc[:, common] = pd.DataFrame(resid + f_mean, index=factor.index, columns=common)
    return out


def neutralize_combined(
    factor: pd.DataFrame,
    sector_map: pd.Series | None = None,
    size_map: pd.Series | None = None,
) -> pd.DataFrame:
    """Apply sector demean then size residualization. Either may be None to skip."""
    out = factor
    if sector_map is not None:
        out = sector_neutralize(out, sector_map)
    if size_map is not None:
        out = size_neutralize(out, size_map)
    return out


# ---------- v0.13: within-sector ranking ----------


def cs_rank_grouped(
    wide: pd.DataFrame, sector_map: pd.Series, min_group_size: int = 4
) -> pd.DataFrame:
    """Per-row rank within each sector group.

    Sectors with < min_group_size symbols fall back to global rank for those
    symbols (so we don't waste signal on tiny sectors like Energy with 2 names).
    All output values are in [-1, 1] (rank percentile minus 0.5, times 2).
    """
    common = wide.columns.intersection(sector_map.index)
    sec = sector_map.loc[common]
    out = pd.DataFrame(np.nan, index=wide.index, columns=wide.columns)

    fallback_cols = []
    for sector_label, group in sec.groupby(sec):
        cols = group.index
        if len(cols) >= min_group_size:
            sub = wide.loc[:, cols]
            out.loc[:, cols] = (sub.rank(axis=1, method="average", pct=True) - 0.5) * 2.0
        else:
            fallback_cols.extend(cols)

    if fallback_cols:
        sub = wide.loc[:, fallback_cols]
        out.loc[:, fallback_cols] = (
            sub.rank(axis=1, method="average", pct=True) - 0.5
        ) * 2.0

    # Symbols with no sector mapping: global rank.
    missing = wide.columns.difference(common)
    if len(missing):
        sub = wide.loc[:, missing]
        out.loc[:, missing] = (sub.rank(axis=1, method="average", pct=True) - 0.5) * 2.0

    return out
