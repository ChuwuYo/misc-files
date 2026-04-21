"""Factor evaluation — IC, Rank IC, IR, quintile spread, turnover, decay curve.

Standard set inspired by alphalens-reloaded `performance.py` and Qlib
`contrib.eval`, kept dependency-free (just pandas/numpy) for portability.

v0.4 additions:
    - Spearman rank IC alongside Pearson IC
    - t-stat (IC mean × √N) for significance
    - `ic_decay(factor, close, horizons)` — IC at each forward horizon
    - `ic_half_life(decay)` — exponential half-life fit
    - `ic_autocorr(ic_series)` — IC time-series autocorrelation
    - `evaluate_horizons(...)` — unified multi-horizon report
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

import numpy as np
import pandas as pd


@dataclass
class FactorReport:
    ic_mean: float            # Pearson IC mean
    ic_std: float
    ic_ir: float
    rank_ic_mean: float       # Spearman rank IC mean
    rank_ic_ir: float
    t_stat: float             # IC mean * sqrt(N) — significance
    top_minus_bottom_ann: float
    turnover: float
    n_dates: int
    n_symbols_avg: float

    def __str__(self) -> str:
        return (
            f"IC mean={self.ic_mean:+.4f}  std={self.ic_std:.4f}  IR={self.ic_ir:+.3f}  "
            f"t={self.t_stat:+.2f}\n"
            f"Rank IC mean={self.rank_ic_mean:+.4f}  IR={self.rank_ic_ir:+.3f}\n"
            f"Top-Bottom annualized={self.top_minus_bottom_ann:+.2%}\n"
            f"Turnover (daily, one-way)={self.turnover:.2%}\n"
            f"Dates={self.n_dates}  Avg symbols/day={self.n_symbols_avg:.0f}"
        )


def _forward_return(close: pd.DataFrame, horizon: int = 1) -> pd.DataFrame:
    return close.shift(-horizon) / close - 1.0


def _row_corr(a: pd.DataFrame, b: pd.DataFrame) -> pd.Series:
    """Per-row Pearson correlation, ignoring NaNs."""
    a, b = a.align(b, join="inner")
    am = a.sub(a.mean(axis=1), axis=0)
    bm = b.sub(b.mean(axis=1), axis=0)
    num = (am * bm).sum(axis=1)
    den = np.sqrt((am ** 2).sum(axis=1) * (bm ** 2).sum(axis=1))
    return num / den.replace(0, np.nan)


def _row_rank_corr(a: pd.DataFrame, b: pd.DataFrame) -> pd.Series:
    """Per-row Spearman rank correlation = Pearson on per-row ranks.

    More robust to cross-sectional outliers than Pearson IC.
    """
    a, b = a.align(b, join="inner")
    return _row_corr(a.rank(axis=1), b.rank(axis=1))


def evaluate(
    factor: pd.DataFrame,
    close_wide: pd.DataFrame,
    horizon: int = 1,
    n_quantiles: int = 5,
    annualization: int = 252,
) -> FactorReport:
    fwd = _forward_return(close_wide, horizon=horizon)
    f, r = factor.align(fwd, join="inner")

    ic = _row_corr(f, r).dropna()
    rank_ic = _row_rank_corr(f, r).dropna()

    qs = f.apply(
        lambda row: pd.qcut(row, n_quantiles, labels=False, duplicates="drop"),
        axis=1,
    )
    top_mask = qs == (n_quantiles - 1)
    bot_mask = qs == 0
    top_ret = (r.where(top_mask)).mean(axis=1)
    bot_ret = (r.where(bot_mask)).mean(axis=1)
    spread = (top_ret - bot_ret).dropna()
    ann = (1 + spread.mean()) ** annualization - 1

    pos = np.sign(f)
    flips = (pos.diff().abs() > 0).sum(axis=1) / pos.notna().sum(axis=1)
    turnover = flips.mean()

    ic_std = ic.std() if len(ic) > 1 else float("nan")
    rank_std = rank_ic.std() if len(rank_ic) > 1 else float("nan")

    return FactorReport(
        ic_mean=ic.mean(),
        ic_std=ic_std,
        ic_ir=ic.mean() / ic_std * np.sqrt(annualization) if ic_std else float("nan"),
        rank_ic_mean=rank_ic.mean(),
        rank_ic_ir=rank_ic.mean() / rank_std * np.sqrt(annualization) if rank_std else float("nan"),
        t_stat=ic.mean() * np.sqrt(len(ic)) / ic_std if ic_std else float("nan"),
        top_minus_bottom_ann=ann,
        turnover=turnover,
        n_dates=len(ic),
        n_symbols_avg=f.notna().sum(axis=1).mean(),
    )


# ---------- v0.4: multi-horizon analysis ----------


def ic_decay(
    factor: pd.DataFrame,
    close_wide: pd.DataFrame,
    horizons: Sequence[int] = (1, 2, 3, 5, 10, 20, 30),
    use_rank: bool = True,
) -> pd.DataFrame:
    """Compute IC at each forward horizon. Returns DataFrame with columns:
    ic_pearson, ic_spearman, ic_ir_p, ic_ir_s, t_stat, n_obs.
    """
    rows = []
    for h in horizons:
        fwd = _forward_return(close_wide, horizon=h)
        f, r = factor.align(fwd, join="inner")
        ic_p = _row_corr(f, r).dropna()
        ic_s = _row_rank_corr(f, r).dropna()
        sp, ss = ic_p.std(), ic_s.std()
        rows.append(
            dict(
                horizon=h,
                ic_pearson=ic_p.mean(),
                ic_spearman=ic_s.mean(),
                ic_ir_p=ic_p.mean() / sp * np.sqrt(252) if sp else np.nan,
                ic_ir_s=ic_s.mean() / ss * np.sqrt(252) if ss else np.nan,
                t_stat=ic_p.mean() * np.sqrt(len(ic_p)) / sp if sp else np.nan,
                n_obs=len(ic_p),
            )
        )
    return pd.DataFrame(rows).set_index("horizon")


def ic_half_life(decay: pd.DataFrame, ic_col: str = "ic_spearman") -> float:
    """Fit IC(h) = IC(1) * exp(-lambda * (h-1)), return ln(2)/lambda.

    Skips negative IC values (signal flip means decay model invalid).
    Returns NaN if fit fails or IC stays flat.
    """
    valid = decay[decay[ic_col] > 0]
    if len(valid) < 3:
        return float("nan")
    h = valid.index.to_numpy(dtype=float)
    ic = valid[ic_col].to_numpy()
    # log-linear fit: log(IC) = log(IC0) - lambda * (h-1)
    try:
        slope, intercept = np.polyfit(h - 1, np.log(ic), 1)
        if slope >= 0:
            return float("inf")
        return float(np.log(2) / -slope)
    except (ValueError, np.linalg.LinAlgError):
        return float("nan")


def ic_autocorr(
    factor: pd.DataFrame,
    close_wide: pd.DataFrame,
    horizon: int = 1,
    max_lag: int = 20,
    use_rank: bool = True,
) -> pd.Series:
    """Autocorrelation of the per-date IC series. Low values (< 0.1) indicate
    pure alpha; high values (> 0.5) indicate market-regime dependence.
    """
    fwd = _forward_return(close_wide, horizon=horizon)
    f, r = factor.align(fwd, join="inner")
    ic = (_row_rank_corr(f, r) if use_rank else _row_corr(f, r)).dropna()
    lags = range(1, max_lag + 1)
    return pd.Series(
        {lag: ic.autocorr(lag=lag) for lag in lags}, name="ic_autocorr"
    )


def evaluate_horizons(
    factor: pd.DataFrame,
    close_wide: pd.DataFrame,
    horizons: Sequence[int] = (1, 2, 3, 5, 10, 20, 30),
    annualization: int = 252,
) -> dict:
    """Unified multi-horizon report: per-horizon IC + half-life + autocorr."""
    decay = ic_decay(factor, close_wide, horizons=horizons)
    decay["ic_decay_pct"] = decay["ic_spearman"] / decay["ic_spearman"].iloc[0]
    half = ic_half_life(decay)
    autocorr = ic_autocorr(factor, close_wide, horizon=horizons[0])
    return {
        "decay": decay,
        "half_life_bars": half,
        "ic_autocorr": autocorr,
    }


if __name__ == "__main__":
    import time
    from src.data import sample_panel, to_wide
    from src.factor import compute_factor

    panel = sample_panel(n_dates=252, n_symbols=500, seed=42)
    f = compute_factor(panel, window=5)
    cw = to_wide(panel, field="close")
    print(evaluate(f, cw, horizon=1))
    print()
    rep = evaluate_horizons(f, cw, horizons=(1, 2, 3, 5, 10, 20))
    print("decay:")
    print(rep["decay"].round(4))
    print(f"\nhalf-life: {rep['half_life_bars']:.2f} bars")
    print(f"ic autocorr (lag 1-5): {rep['ic_autocorr'].head().round(3).to_dict()}")
