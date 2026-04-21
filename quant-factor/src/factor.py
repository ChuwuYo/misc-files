"""Factor v0.3 — multi-timeframe vol-dampened reversal.

Per-TF pipeline (unchanged from v0.2):
    close[tf]
      -> reversal_signal(window)
      -> winsorize(0.01, 0.99)
      -> vol_dampen(vol_window=20, α)
      -> cs_rank
      -> neg

Multi-TF combiner stacks per-TF signals after re-aligning to the finest
TF index, then either equal-weights or IC-weights them.

Inspirations:
    - Jegadeesh (1990), AHXZ (2006), FP (2014), Alpha101 — base pipeline
    - Moskowitz/Ooi/Pedersen (2012) Time-Series Momentum — HTF + LTF combo logic
    - Han/Zhou/Zhu (2016) Trend Factor — multi-window aggregation
    - Qlib `qlib/contrib/data/handler.py` — freq-agnostic handler design
    - vnpy `BarGenerator` — multi-TF aggregation idiom
"""
from __future__ import annotations

from typing import Iterable, Literal

import numpy as np
import pandas as pd

from .alphas import ALPHA_REGISTRY, WideOHLCV
from .data import to_wide
from .pipeline import (
    Pipeline,
    cs_rank,
    cs_zscore,
    neg,
    reversal_signal,
    vol_dampen,
    winsorize,
)
from .timeframes import TimeFrame, resample_panel


def build_pipeline(
    window: int = 5,
    vol_window: int = 20,
    vol_alpha: float = 1.0,
    winsor: tuple[float, float] = (0.01, 0.99),
) -> Pipeline:
    return (
        Pipeline()
        .add("reversal", reversal_signal(window))
        .add("winsorize", winsorize(*winsor))
        .add("vol_dampen", vol_dampen(vol_window, vol_alpha))
        .add("cs_rank", cs_rank)
        .add("neg", neg)
    )


def compute_factor(
    panel: pd.DataFrame,
    window: int = 5,
    price_col: str = "close",
    vol_window: int = 20,
    vol_alpha: float = 1.0,
) -> pd.DataFrame:
    """Single-TF factor (v0.2-compatible). Set vol_alpha=0 to recover v0.1."""
    close = to_wide(panel, field=price_col)
    pipe = build_pipeline(window=window, vol_window=vol_window, vol_alpha=vol_alpha)
    return pipe.run(close)


# ---------- v0.3: multi-timeframe ----------

CombinerName = Literal["equal", "ic_weight"]


def _align_to_finest(
    signals: dict[TimeFrame, pd.DataFrame], finest_index: pd.DatetimeIndex
) -> dict[TimeFrame, pd.DataFrame]:
    """Forward-fill each TF's signal onto the finest TF's index.

    HTF signals stay constant within their bar; LTF signals are unchanged.
    """
    out = {}
    for tf, sig in signals.items():
        common_cols = sig.columns
        out[tf] = sig.reindex(finest_index).ffill()[common_cols]
    return out


def _ic_rolling_weights(
    signals: dict[TimeFrame, pd.DataFrame],
    forward_returns: pd.DataFrame,
    lookback: int = 60,
    signed: bool = True,
) -> dict[TimeFrame, pd.Series]:
    """Per-date weight for each TF based on trailing-`lookback` mean IC.

    If `signed=True`: weight = IC itself (sign preserved), normalized by L1-norm
    per date — TFs with negative IC contribute with FLIPPED sign automatically.
    This handles the case where signal direction differs across TFs (common
    when aggregation reverses the sign of an injected signal).

    If `signed=False`: only positive-IC TFs contribute (legacy behavior).
    """
    ics = {}
    for tf, sig in signals.items():
        s, r = sig.align(forward_returns, join="inner")
        sm = s.sub(s.mean(axis=1), axis=0)
        rm = r.sub(r.mean(axis=1), axis=0)
        num = (sm * rm).sum(axis=1)
        den = np.sqrt((sm ** 2).sum(axis=1) * (rm ** 2).sum(axis=1))
        ics[tf] = (
            (num / den.replace(0, np.nan))
            .rolling(lookback, min_periods=10)
            .mean()
        )
    ic_df = pd.concat(ics, axis=1)

    if signed:
        # Use sign-preserving IC; tiny floor to avoid all-zero rows.
        raw = ic_df.fillna(0)
        l1 = raw.abs().sum(axis=1).replace(0, np.nan)
        weights = raw.div(l1, axis=0).fillna(0)
        # Where weights all zero (cold start), fall back to equal positive weight.
        equal_fallback = pd.Series(1.0 / ic_df.shape[1], index=weights.index)
        cold = weights.abs().sum(axis=1) == 0
        for col in weights.columns:
            weights.loc[cold, col] = equal_fallback[cold]
    else:
        pos = ic_df.clip(lower=0).fillna(0)
        row_sum = pos.sum(axis=1).replace(0, np.nan)
        weights = pos.div(row_sum, axis=0).fillna(1.0 / ic_df.shape[1])

    return {tf: weights[tf] for tf in signals.keys()}


def compute_mtf_factor(
    panel: pd.DataFrame,
    timeframes: Iterable[TimeFrame] = (
        TimeFrame.M5,
        TimeFrame.M15,
        TimeFrame.H1,
        TimeFrame.D1,
    ),
    window_per_tf: int = 5,
    vol_window: int = 20,
    vol_alpha: float = 1.0,
    combiner: CombinerName = "equal",
    ic_lookback: int = 60,
    return_components: bool = False,
) -> pd.DataFrame | tuple[pd.DataFrame, dict[TimeFrame, pd.DataFrame]]:
    """Compute multi-timeframe factor.

    Args:
        panel: long OHLCV panel at the finest TF (or daily — we resample up).
        timeframes: TFs to compute signals on.
        window_per_tf: reversal window in **bars** of each TF.
        vol_window / vol_alpha: dampen settings (in bars per TF).
        combiner: 'equal' = z-score then mean; 'ic_weight' = trailing-IC weighted mean.
        ic_lookback: bars of trailing IC for ic_weight combiner.
        return_components: if True, also return the per-TF signal dict.

    Returns:
        Wide (datetime × symbol) factor at the **finest** TF requested.
    """
    tfs = list(timeframes)
    finest = min(tfs, key=lambda t: list(TimeFrame).index(t))

    per_tf_signal = {}
    for tf in tfs:
        rs = resample_panel(panel, tf)
        sig = compute_factor(
            rs,
            window=window_per_tf,
            vol_window=vol_window,
            vol_alpha=vol_alpha,
        )
        per_tf_signal[tf] = sig

    finest_idx = per_tf_signal[finest].index
    aligned = _align_to_finest(per_tf_signal, finest_idx)

    if combiner == "equal":
        zs = {tf: ((s.sub(s.mean(axis=1), axis=0))
                   .div(s.std(axis=1).replace(0, np.nan), axis=0))
              for tf, s in aligned.items()}
        stacked = pd.concat(zs.values(), axis=0).groupby(level=0).mean()
        # cs_rank to keep output in [-1, 1]
        combined = (stacked.rank(axis=1, pct=True) - 0.5) * 2.0
    elif combiner == "ic_weight":
        # Compute forward return at finest TF; weights derived from rolling IC
        # are SHIFTED by 1 bar to remove lookahead bias (weights at t can only
        # use info known up to t, i.e. IC computed from fwd ending at t-1).
        finest_close = to_wide(resample_panel(panel, finest), "close")
        fwd_finest = (finest_close.shift(-1) / finest_close - 1.0).reindex(finest_idx)
        weights = _ic_rolling_weights(
            aligned, fwd_finest, lookback=ic_lookback, signed=True
        )
        weights = {tf: w.shift(1).fillna(0) for tf, w in weights.items()}
        combined = sum(aligned[tf].mul(weights[tf], axis=0) for tf in tfs)
        combined = (combined.rank(axis=1, pct=True) - 0.5) * 2.0
    else:
        raise ValueError(f"unknown combiner: {combiner}")

    if return_components:
        return combined, per_tf_signal
    return combined


__version__ = "0.9.0"


# ---------- v0.5: signal pool (alpha × timeframe) ----------


def _to_ohlcv_wide(panel: pd.DataFrame) -> WideOHLCV:
    fields = [c for c in ("open", "high", "low", "close", "volume") if c in panel.columns]
    return {f: to_wide(panel, field=f) for f in fields}


def _zscore_cs(df: pd.DataFrame) -> pd.DataFrame:
    mu = df.mean(axis=1)
    sd = df.std(axis=1).replace(0, np.nan)
    return df.sub(mu, axis=0).div(sd, axis=0)


def compute_pool_factor(
    panel: pd.DataFrame,
    alphas: Iterable[str] = ("reversal_v02", "alpha001", "alpha004", "alpha006", "alpha012"),
    timeframes: Iterable[TimeFrame] = (TimeFrame.M5, TimeFrame.M15, TimeFrame.H1),
    combiner: CombinerName = "ic_weight",
    ic_lookback: int = 60,
    min_abs_ic: float = 0.0,
    warmup_screen: dict | None = None,
    orthogonalize: bool = False,
    pca_k: int | None = None,
    pca_auto: bool = False,
    smooth_lambda: float = 0.0,
    return_components: bool = False,
) -> pd.DataFrame | tuple[pd.DataFrame, dict[str, pd.DataFrame]]:
    """Signal pool: every (alpha, timeframe) becomes one signal.

    All signals are aligned to the finest TF and combined via the same
    ic_weight signed combiner used in v0.3 — but now with `len(alphas) *
    len(timeframes)` slots in the pool.

    Returns the wide combined factor (and optionally the per-signal dict).
    """
    tfs = list(timeframes)
    finest = min(tfs, key=lambda t: list(TimeFrame).index(t))
    alphas = list(alphas)

    # v0.8: optional warmup t-stat screening to drop dead slots before pooling.
    if warmup_screen is not None:
        from .selection import screen_alphas_by_warmup
        kept_pairs, _ = screen_alphas_by_warmup(
            panel, alphas, tfs,
            warmup_frac=warmup_screen.get("warmup_frac", 0.5),
            min_abs_t=warmup_screen.get("min_abs_t", 2.0),
            top_k=warmup_screen.get("top_k"),
            horizon=warmup_screen.get("horizon", 1),
        )
        if not kept_pairs:
            raise ValueError("warmup_screen left zero slots — relax min_abs_t or top_k")
        # Constrain to (alpha, tf) survivors only.
        keep_set = set((a, t.name) for a, t in kept_pairs)
    else:
        keep_set = None

    components: dict[str, pd.DataFrame] = {}
    for tf in tfs:
        rs = resample_panel(panel, tf)
        ohlcv = _to_ohlcv_wide(rs)
        for name in alphas:
            if keep_set is not None and (name, tf.name) not in keep_set:
                continue
            fn = ALPHA_REGISTRY[name]
            sig = fn(ohlcv)
            components[f"{name}@{tf.name}"] = sig

    finest_close = to_wide(resample_panel(panel, finest), "close")
    finest_idx = finest_close.index
    aligned = {
        k: v.reindex(finest_idx).ffill() for k, v in components.items()
    }

    # v0.8: optional Gram-Schmidt orthogonalization in t-stat order to remove
    # signal redundancy (KBAR alphas are highly cross-correlated).
    if orthogonalize and len(aligned) > 1:
        from .selection import gram_schmidt_orthogonalize, _signal_tstat
        # rank by warmup-period |t|
        fwd_full = finest_close.shift(-1) / finest_close - 1.0
        scored = []
        for k, s in aligned.items():
            _, t, _ = _signal_tstat(s, fwd_full)
            scored.append((abs(t), k))
        order = [k for _, k in sorted(scored, reverse=True)]
        aligned = gram_schmidt_orthogonalize(aligned, order)

    # v0.9: optional PCA denoising — collapse to top-k principal components.
    if (pca_k is not None or pca_auto) and len(aligned) > 1:
        from .denoise import pca_denoise_signals
        aligned = pca_denoise_signals(
            aligned, k=pca_k, use_mp_threshold=pca_auto and pca_k is None
        )

    if combiner == "equal":
        zs = {k: _zscore_cs(s) for k, s in aligned.items()}
        stacked = pd.concat(zs.values(), axis=0).groupby(level=0).mean()
        combined = (stacked.rank(axis=1, pct=True) - 0.5) * 2.0

    elif combiner == "ic_weight":
        fwd = (finest_close.shift(-1) / finest_close - 1.0).reindex(finest_idx)
        # Build per-signal IC series and rolling weights. Reuse helper but
        # the dict keys become signal names instead of TimeFrames.
        ics = {}
        for name, sig in aligned.items():
            s, r = sig.align(fwd, join="inner")
            sm = s.sub(s.mean(axis=1), axis=0)
            rm = r.sub(r.mean(axis=1), axis=0)
            num = (sm * rm).sum(axis=1)
            den = np.sqrt((sm ** 2).sum(axis=1) * (rm ** 2).sum(axis=1))
            ics[name] = (
                (num / den.replace(0, np.nan))
                .rolling(ic_lookback, min_periods=10)
                .mean()
            )
        ic_df = pd.concat(ics, axis=1)
        raw = ic_df.fillna(0)
        # Sparsification: zero out signals whose trailing |IC| is below threshold
        # (Qian-Hua-style filter — kills noise contributors).
        if min_abs_ic > 0:
            raw = raw.where(raw.abs() >= min_abs_ic, 0)
        l1 = raw.abs().sum(axis=1).replace(0, np.nan)
        weights = raw.div(l1, axis=0).fillna(0).shift(1).fillna(0)

        combined_raw = sum(
            aligned[name].mul(weights[name], axis=0) for name in components
        )
        combined = (combined_raw.rank(axis=1, pct=True) - 0.5) * 2.0

    else:
        raise ValueError(f"unknown combiner: {combiner}")

    # v0.9: optional EWMA factor smoothing — slashes turnover.
    if smooth_lambda > 0:
        from .denoise import ewma_smooth
        combined = ewma_smooth(combined, lambda_=smooth_lambda)

    if return_components:
        return combined, components
    return combined
