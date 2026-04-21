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

    Vectorized via numpy: per-row beta = sum(r*p) / sum(p*p) computed in
    array-wise sums (no pd.loc indexing). Assumes all signals share the same
    (index, columns) — true for our pool since we reindex to finest TF before
    calling this.
    """
    if not order:
        return {}
    ref = signals[order[0]]
    idx, cols = ref.index, ref.columns

    ortho: dict[str, pd.DataFrame] = {}
    selected_arrs: list[np.ndarray] = []

    for name in order:
        s_df = signals[name].reindex(index=idx, columns=cols)
        s_arr = s_df.to_numpy(dtype=float, copy=True)
        residual = s_arr
        for p_arr in selected_arrs:
            # Per-row OLS beta: sum_cols(r*p) / sum_cols(p*p), NaN-safe.
            num = np.nansum(residual * p_arr, axis=1)
            den = np.nansum(p_arr * p_arr, axis=1)
            with np.errstate(divide="ignore", invalid="ignore"):
                beta = np.where(den > 0, num / den, 0.0)
            residual = residual - beta[:, None] * p_arr
        ortho[name] = pd.DataFrame(residual, index=idx, columns=cols)
        selected_arrs.append(residual)

    return ortho
