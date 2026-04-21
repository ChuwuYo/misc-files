"""Denoising + smoothing utilities — PCA on signal pool, EWMA on factor.

References:
    - Marchenko-Pastur 1967: random matrix eigenvalue upper bound
    - Ledoit-Wolf 2004: optimal covariance shrinkage (mentioned but not implemented here)
    - EWMA: classic exponential moving average
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def marchenko_pastur_threshold(n_signals: int, n_obs: int, sigma2: float = 1.0) -> float:
    """Upper bound on eigenvalues of a pure-noise covariance matrix.

    Eigenvalues above this threshold are *signal*, below are *noise*.
    Assumes the input was z-scored to unit variance (sigma2=1).
    """
    if n_obs <= 0 or n_signals <= 0:
        return float("inf")
    return float(sigma2 * (1.0 + np.sqrt(n_signals / n_obs)) ** 2)


def pca_denoise_signals(
    signals: dict[str, pd.DataFrame],
    k: int | None = None,
    use_mp_threshold: bool = True,
) -> dict[str, pd.DataFrame]:
    """Stack signals across (date × symbol) cells, do PCA over the *signal axis*,
    return reconstruction using top-K components.

    For each date t and symbol s, signals[t,s,:] is an N-dim vector. We collapse
    to a 2D matrix [(date, symbol), signal] for PCA, then reproject back.

    Args:
        signals: dict[name -> wide DataFrame (date × symbol)]
        k: keep top-K components. If None, use Marchenko-Pastur threshold.
        use_mp_threshold: when k is None, auto-pick K using MP bound.

    Returns:
        Same-keyed dict where each DataFrame is the denoised reconstruction.
        (Per-signal direction is preserved; only the noise component is removed.)
    """
    names = list(signals.keys())
    if not names:
        return signals

    aligned = {n: signals[n] for n in names}
    # Flatten: rows = date × symbol, cols = signal name.
    stacked = pd.concat(
        {n: aligned[n].stack() for n in names}, axis=1, names=["signal"]
    ).dropna(how="any")
    if stacked.empty or stacked.shape[1] < 2:
        return signals

    X = stacked.to_numpy()
    # Center per signal (column).
    mu = X.mean(axis=0, keepdims=True)
    Xc = X - mu
    # SVD-based PCA — robust on ill-conditioned matrices.
    U, S, Vt = np.linalg.svd(Xc, full_matrices=False)
    eigvals = (S ** 2) / max(len(X) - 1, 1)

    if k is None and use_mp_threshold:
        # Threshold in unit-variance scale: rescale eigvals by total variance fraction.
        sigma2_est = np.median(eigvals)
        thresh = marchenko_pastur_threshold(
            n_signals=X.shape[1], n_obs=X.shape[0], sigma2=sigma2_est
        )
        k = max(1, int((eigvals > thresh).sum()))
    elif k is None:
        k = X.shape[1]
    k = min(k, X.shape[1])

    # Reconstruct using top-k components.
    S_k = np.zeros_like(S)
    S_k[:k] = S[:k]
    X_recon = U @ np.diag(S_k) @ Vt + mu

    out: dict[str, pd.DataFrame] = {}
    recon_df = pd.DataFrame(X_recon, index=stacked.index, columns=stacked.columns)
    for n in names:
        col = recon_df[n].unstack()
        out[n] = col.reindex(index=aligned[n].index, columns=aligned[n].columns)
    return out


def ewma_smooth(factor: pd.DataFrame, lambda_: float = 0.5) -> pd.DataFrame:
    """Exponential moving average smoothing of a wide factor.

    factor_smooth[t] = (1 - λ) * factor[t] + λ * factor_smooth[t-1]

    λ=0 -> no smoothing (return as-is)
    λ=0.5 -> half-life ≈ 1 bar
    λ=0.7 -> half-life ≈ 2 bars
    λ=0.9 -> half-life ≈ 6.6 bars
    """
    if lambda_ <= 0:
        return factor
    if lambda_ >= 1:
        raise ValueError("lambda_ must be in [0, 1)")
    return factor.ewm(alpha=1.0 - lambda_, adjust=False).mean()
