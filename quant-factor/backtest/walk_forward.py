"""Walk-forward (anchored, expanding-train) cross-validation for factor configs.

Replaces the v0.7-v0.10 50/50 IS/OOS split with K independent OOS sub-periods
so we can report `mean_ic ± std_ic` and `t-stat` across folds — much more
honest than a single OOS estimate that conflates alpha with regime change.

Reference:
    - López de Prado (2018) "Advances in Financial Machine Learning" Ch.7
    - Bailey & López de Prado (2014) "The Deflated Sharpe Ratio"

Caveats:
    - PCA inside `compute_pool_factor` currently uses full-window SVD —
      mild forward-looking. v0.12 will split fit/transform.
    - `purge` parameter removes the last `horizon` train days that overlap
      with test forward returns.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd

from src.data import to_wide
from .evaluate import _row_corr, _row_rank_corr, _forward_return


@dataclass
class FoldResult:
    fold: int
    train_start: pd.Timestamp
    train_end: pd.Timestamp
    test_start: pd.Timestamp
    test_end: pd.Timestamp
    n_train_dates: int
    n_test_dates: int
    ic_pearson: float
    ic_spearman: float
    t_stat: float


@dataclass
class WalkForwardReport:
    horizon: int
    folds: list[FoldResult]
    mean_ic: float
    std_ic: float
    mean_rank_ic: float
    aggregate_t: float        # mean / (std/sqrt(K))
    win_rate: float           # fraction of folds with IC > 0

    def __str__(self) -> str:
        return (
            f"WalkForward h={self.horizon}  K={len(self.folds)}  "
            f"IC={self.mean_ic:+.4f} ± {self.std_ic:.4f}  "
            f"rank_IC={self.mean_rank_ic:+.4f}  "
            f"agg_t={self.aggregate_t:+.2f}  "
            f"win_rate={self.win_rate:.1%}"
        )

    def to_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(
            [
                dict(
                    fold=f.fold,
                    train_start=str(f.train_start.date()),
                    train_end=str(f.train_end.date()),
                    test_start=str(f.test_start.date()),
                    test_end=str(f.test_end.date()),
                    n_train=f.n_train_dates,
                    n_test=f.n_test_dates,
                    ic=f.ic_pearson,
                    rank_ic=f.ic_spearman,
                    t=f.t_stat,
                )
                for f in self.folds
            ]
        )


def _ic_for_period(
    factor: pd.DataFrame,
    close: pd.DataFrame,
    horizon: int,
    test_dates: pd.DatetimeIndex,
) -> tuple[float, float, float]:
    """IC stats restricted to test_dates."""
    fwd = _forward_return(close, horizon=horizon)
    f, r = factor.align(fwd, join="inner")
    f = f.loc[f.index.isin(test_dates)]
    r = r.loc[r.index.isin(test_dates)]
    ic = _row_corr(f, r).dropna()
    rank_ic = _row_rank_corr(f, r).dropna()
    if len(ic) < 5 or ic.std() == 0:
        return float(ic.mean() if len(ic) else 0), float(rank_ic.mean() if len(rank_ic) else 0), 0.0
    t = ic.mean() * np.sqrt(len(ic)) / ic.std()
    return float(ic.mean()), float(rank_ic.mean()), float(t)


def walk_forward_evaluate(
    panel: pd.DataFrame,
    factor_fn: Callable[[pd.DataFrame], pd.DataFrame],
    n_splits: int = 5,
    min_train_dates: int = 180,
    test_size: int = 120,
    purge: int = 10,
    horizon: int = 10,
    price_col: str = "close",
) -> WalkForwardReport:
    """Anchored walk-forward: train window expands; test window slides.

    Fold i:
        train = panel[date < (min_train + i*test_size) - purge]
        test  = panel[(min_train + i*test_size) <= date < (min_train + (i+1)*test_size)]
        factor_fn is called on (train + test) — assumed to be causal internally.

    Returns aggregate stats + per-fold detail.
    """
    dates = sorted(pd.to_datetime(panel["date"].unique()))
    if len(dates) < min_train_dates + test_size:
        raise ValueError(
            f"Not enough dates: {len(dates)} < min_train+test={min_train_dates + test_size}"
        )

    folds: list[FoldResult] = []
    for i in range(n_splits):
        test_start_idx = min_train_dates + i * test_size
        test_end_idx = min_train_dates + (i + 1) * test_size
        if test_end_idx > len(dates):
            break
        train_cutoff_idx = max(test_start_idx - purge, 1)
        train_end_date = dates[train_cutoff_idx - 1]
        test_start_date = dates[test_start_idx]
        test_end_date = dates[test_end_idx - 1]

        # Factor must see only data up through test_end (no future). We pass
        # the entire (train + test) slice — the factor's combiner uses
        # rolling-IC with shift(1), so test-period weights only use past info.
        slice_panel = panel[panel["date"] <= test_end_date].copy()
        try:
            factor = factor_fn(slice_panel)
        except Exception as e:
            print(f"fold {i} factor_fn failed: {e}")
            continue

        close = to_wide(slice_panel, field=price_col)
        test_dates = pd.DatetimeIndex(dates[test_start_idx:test_end_idx])
        ic, rank_ic, t = _ic_for_period(factor, close, horizon, test_dates)

        folds.append(
            FoldResult(
                fold=i,
                train_start=dates[0],
                train_end=train_end_date,
                test_start=test_start_date,
                test_end=test_end_date,
                n_train_dates=train_cutoff_idx,
                n_test_dates=len(test_dates),
                ic_pearson=ic,
                ic_spearman=rank_ic,
                t_stat=t,
            )
        )

    if not folds:
        raise RuntimeError("walk-forward produced zero folds")

    ics = np.array([f.ic_pearson for f in folds])
    rank_ics = np.array([f.ic_spearman for f in folds])
    mean = float(ics.mean())
    std = float(ics.std(ddof=1)) if len(ics) > 1 else float("nan")
    agg_t = mean / (std / np.sqrt(len(folds))) if std and not np.isnan(std) else float("nan")
    win = float((ics > 0).mean())
    return WalkForwardReport(
        horizon=horizon,
        folds=folds,
        mean_ic=mean,
        std_ic=std,
        mean_rank_ic=float(rank_ics.mean()),
        aggregate_t=agg_t,
        win_rate=win,
    )
