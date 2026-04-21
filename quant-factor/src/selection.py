"""Signal selection + orthogonalization — fixes v0.7 over-parameterization
on real data, where 26 noisy slots dilute the few real signals.

References:
    - Sullivan/Timmermann/White (1999) — data-snooping control
    - Hou-Xue-Zhang (2015) q-factor — t-stat-based factor evaluation
    - Bonferroni multiple-testing correction
"""
from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd

from .alphas import ALPHA_REGISTRY
from .data import to_wide
from .timeframes import TimeFrame, resample_panel


def _signal_tstat(sig: pd.DataFrame, fwd: pd.DataFrame) -> tuple[float, float, int]:
    """Return (mean_ic, t_stat, n_obs) for a single (date × symbol) signal."""
    s, r = sig.align(fwd, join="inner")
    sm = s.sub(s.mean(axis=1), axis=0)
    rm = r.sub(r.mean(axis=1), axis=0)
    num = (sm * rm).sum(axis=1)
    den = np.sqrt((sm ** 2).sum(axis=1) * (rm ** 2).sum(axis=1))
    ic = (num / den.replace(0, np.nan)).dropna()
    if len(ic) < 5 or ic.std() == 0:
        return 0.0, 0.0, len(ic)
    t = ic.mean() * np.sqrt(len(ic)) / ic.std()
    return float(ic.mean()), float(t), int(len(ic))


def screen_alphas_by_warmup(
    panel: pd.DataFrame,
    alphas: Iterable[str],
    timeframes: Iterable[TimeFrame],
    warmup_frac: float = 0.5,
    min_abs_t: float = 2.0,
    top_k: int | None = None,
    horizon: int = 1,
) -> tuple[list[tuple[str, TimeFrame]], pd.DataFrame]:
    """Screen (alpha, tf) slots by t-stat on a warmup slice.

    Returns:
        kept: list of surviving (alpha_name, tf) tuples
        report: DataFrame with mean_ic / t_stat / n_obs / kept flag per slot
    """
    dates = sorted(panel["date"].unique())
    cutoff = dates[int(len(dates) * warmup_frac)]
    p_warm = panel[panel["date"] < cutoff]

    rows = []
    for tf in timeframes:
        rs = resample_panel(p_warm, tf)
        if len(rs) == 0:
            continue
        ohlcv = {f: to_wide(rs, field=f) for f in ("open", "high", "low", "close", "volume")
                 if f in rs.columns}
        close = ohlcv["close"]
        fwd = (close.shift(-horizon) / close - 1.0)
        for name in alphas:
            sig = ALPHA_REGISTRY[name](ohlcv)
            ic, t, n = _signal_tstat(sig, fwd)
            rows.append(dict(alpha=name, tf=tf.name, mean_ic=ic, t_stat=t, n_obs=n))

    report = pd.DataFrame(rows)
    report["abs_t"] = report["t_stat"].abs()
    report = report.sort_values("abs_t", ascending=False).reset_index(drop=True)
    survived = report[report["abs_t"] >= min_abs_t].copy()
    if top_k is not None:
        survived = survived.head(top_k)
    survived["kept"] = True
    report = report.merge(
        survived[["alpha", "tf", "kept"]], on=["alpha", "tf"], how="left"
    )
    report["kept"] = report["kept"].fillna(False)
    kept = [(row["alpha"], TimeFrame[row["tf"]]) for _, row in survived.iterrows()]
    return kept, report


def gram_schmidt_orthogonalize(
    signals: dict[str, pd.DataFrame],
    order: list[str],
) -> dict[str, pd.DataFrame]:
    """Sequentially regress each signal on the prior selected signals (per-row),
    keeping only the residual. Order matters: process the strongest signal first.

    All signals must share index; columns may differ — we align per row.
    """
    ortho: dict[str, pd.DataFrame] = {}
    selected: list[pd.DataFrame] = []
    for name in order:
        s = signals[name]
        if not selected:
            ortho[name] = s
            selected.append(s)
            continue
        # Per-row OLS: regress s on stacked selected signals, return residual.
        residual = s.copy()
        for prev in selected:
            common_idx = residual.index.intersection(prev.index)
            common_cols = residual.columns.intersection(prev.columns)
            r = residual.loc[common_idx, common_cols]
            p = prev.loc[common_idx, common_cols]
            # Per-row beta = sum(r*p) / sum(p*p)
            denom = (p * p).sum(axis=1).replace(0, np.nan)
            beta = (r * p).sum(axis=1) / denom
            r_new = r.sub(p.mul(beta, axis=0), axis=0)
            residual.loc[common_idx, common_cols] = r_new
        ortho[name] = residual
        selected.append(residual)
    return ortho
