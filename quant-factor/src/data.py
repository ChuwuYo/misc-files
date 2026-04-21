"""Synthetic panel data generators for offline testing.

Real data adapters arrive in v0.7. Until then we test on controlled
processes with known signal structure — a working factor should produce
positive IC on this data.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def sample_panel(
    n_dates: int = 252,
    n_symbols: int = 500,
    seed: int = 42,
    reversal_strength: float = 0.05,
) -> pd.DataFrame:
    """Daily OHLCV panel with cross-sectional reversal injected at lag 1.

    Returns long DataFrame: date, symbol, open, high, low, close, volume.
    """
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2023-01-02", periods=n_dates)
    symbols = [f"S{i:04d}" for i in range(n_symbols)]

    drift = rng.normal(0.0002, 0.0005, n_symbols)
    vol = rng.uniform(0.01, 0.04, n_symbols)
    eps = rng.standard_normal((n_dates, n_symbols)) * vol

    rets = np.zeros_like(eps)
    rets[0] = drift + eps[0]
    for t in range(1, n_dates):
        cs_rank = (eps[t - 1].argsort().argsort() / (n_symbols - 1)) - 0.5
        rets[t] = drift + eps[t] - reversal_strength * cs_rank * vol

    close = 100 * np.exp(np.cumsum(rets, axis=0))
    intraday = rng.uniform(0.002, 0.015, (n_dates, n_symbols))
    high = close * (1 + intraday)
    low = close * (1 - intraday)
    open_ = np.roll(close, 1, axis=0)
    open_[0] = 100
    volume = rng.lognormal(15, 0.5, (n_dates, n_symbols)).astype(np.int64)

    return pd.DataFrame(
        {
            "date": np.repeat(dates, n_symbols),
            "symbol": np.tile(symbols, n_dates),
            "open": open_.flatten(),
            "high": high.flatten(),
            "low": low.flatten(),
            "close": close.flatten(),
            "volume": volume.flatten(),
        }
    )


def sample_intraday_panel(
    n_days: int = 30,
    n_symbols: int = 50,
    bar_minutes: int = 1,
    bars_per_day: int = 240,
    seed: int = 42,
    scale_strengths: dict[int, float] | None = None,
) -> pd.DataFrame:
    """Intraday OHLCV panel with **multi-scale reversal signal injected at
    several explicit horizons** (in base-bar units).

    `scale_strengths` maps `horizon_bars -> strength`. For each horizon H,
    every H bars we compute the cross-sectional rank of the past-H cumulative
    return and inject -strength * rank * bar_vol into the next H bars'
    returns (spread evenly). Multiple horizons stack, so a working MTF
    combiner has signal to combine at multiple TFs.

    Default scales align with M15 / H1 / H4 / D1 (assuming 5min bars):
    """
    if scale_strengths is None:
        scale_strengths = {3: 0.06, 12: 0.10, 48: 0.18, 240: 0.30}

    rng = np.random.default_rng(seed)
    symbols = [f"S{i:04d}" for i in range(n_symbols)]
    total_bars = n_days * bars_per_day
    start = pd.Timestamp("2024-01-02 09:30")
    timestamps = pd.date_range(start, periods=total_bars, freq=f"{bar_minutes}min")

    base_drift = rng.normal(0.0, 1e-5, n_symbols)
    bar_vol = rng.uniform(0.0008, 0.003, n_symbols)
    eps = rng.standard_normal((total_bars, n_symbols)) * bar_vol

    rets = eps + base_drift  # innovations + tiny drift

    # For each scale H, accumulate H-bar cum returns and inject reversal
    # into the next H bars in vectorized blocks.
    for H, strength in scale_strengths.items():
        if H >= total_bars:
            continue
        n_blocks = total_bars // H
        # block i covers [i*H, (i+1)*H)
        cum = rets[: n_blocks * H].reshape(n_blocks, H, n_symbols).sum(axis=1)
        ranks = cum.argsort(axis=1).argsort(axis=1) / (n_symbols - 1) - 0.5
        # injection target = next block's H bars; spread strength evenly.
        for i in range(n_blocks - 1):
            inject = -strength * ranks[i] * bar_vol / H
            rets[(i + 1) * H : (i + 2) * H] += inject

    close = 100 * np.exp(np.cumsum(rets, axis=0))
    spread = rng.uniform(0.0005, 0.003, (total_bars, n_symbols))
    high = close * (1 + spread)
    low = close * (1 - spread)
    open_ = np.roll(close, 1, axis=0)
    open_[0] = 100
    volume = rng.lognormal(10, 0.4, (total_bars, n_symbols)).astype(np.int64)

    return pd.DataFrame(
        {
            "date": np.repeat(timestamps, n_symbols),
            "symbol": np.tile(symbols, total_bars),
            "open": open_.flatten(),
            "high": high.flatten(),
            "low": low.flatten(),
            "close": close.flatten(),
            "volume": volume.flatten(),
        }
    )


def to_wide(panel: pd.DataFrame, field: str = "close") -> pd.DataFrame:
    """Pivot long -> wide (date × symbol) for a single field."""
    return (
        panel.pivot(index="date", columns="symbol", values=field)
        .sort_index()
        .astype("float64")
    )
