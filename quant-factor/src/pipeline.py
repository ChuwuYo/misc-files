"""Composable factor pipeline — stages can be swapped/added per iteration.

Stage protocol: each callable takes wide DataFrames (date × symbol) plus a
shared `ctx` dict (for sharing intermediate computations like log returns)
and returns a wide DataFrame.

Conceptual borrowing:
    - Zipline Pipeline / Quantopian — composable factor primitives
    - Qlib Handler — feature transform stages
    - Alpha101 — operator chain (rank/scale/ts_*)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Protocol

import numpy as np
import pandas as pd


Stage = Callable[[pd.DataFrame, dict], pd.DataFrame]


@dataclass
class Pipeline:
    stages: list[tuple[str, Stage]] = field(default_factory=list)

    def add(self, name: str, stage: Stage) -> "Pipeline":
        self.stages.append((name, stage))
        return self

    def run(self, x: pd.DataFrame, ctx: dict | None = None) -> pd.DataFrame:
        ctx = ctx if ctx is not None else {}
        for _, st in self.stages:
            x = st(x, ctx)
        return x


# ---------- primitives ----------


def cs_rank(wide: pd.DataFrame, _: dict) -> pd.DataFrame:
    """Cross-sectional percentile rank mapped to [-1, 1]."""
    return (wide.rank(axis=1, method="average", pct=True) - 0.5) * 2.0


def neg(wide: pd.DataFrame, _: dict) -> pd.DataFrame:
    return -wide


def winsorize(lower: float = 0.01, upper: float = 0.99) -> Stage:
    """Cross-sectional winsorization to clip outliers."""
    def _stage(wide: pd.DataFrame, _: dict) -> pd.DataFrame:
        lo = wide.quantile(lower, axis=1)
        hi = wide.quantile(upper, axis=1)
        return wide.clip(lower=lo, upper=hi, axis=0)
    return _stage


def cs_zscore(wide: pd.DataFrame, _: dict) -> pd.DataFrame:
    """Cross-sectional z-score per row."""
    mu = wide.mean(axis=1)
    sd = wide.std(axis=1).replace(0, np.nan)
    return wide.sub(mu, axis=0).div(sd, axis=0)


def vol_dampen(vol_window: int = 20, alpha: float = 1.0) -> Stage:
    """Dampen signal by inverse rank of trailing realized vol.

    weight = 1 / (1 + alpha * vol_rank_pct)  ∈ [1/(1+α), 1]
    Low-vol names: weight ≈ 1.  High-vol names: weight ≈ 1/(1+α).

    Reads `ctx['log_ret']` (set by `make_log_ret`).
    """
    def _stage(signal: pd.DataFrame, ctx: dict) -> pd.DataFrame:
        log_ret = ctx["log_ret"]
        vol = log_ret.rolling(vol_window, min_periods=vol_window).std()
        vol_rank = vol.rank(axis=1, method="average", pct=True)
        weight = 1.0 / (1.0 + alpha * vol_rank)
        # Reindex to match signal — vol may have more NaNs early on.
        weight = weight.reindex_like(signal)
        return signal * weight
    return _stage


# ---------- adapters ----------


def make_log_ret(ctx: dict, close: pd.DataFrame) -> pd.DataFrame:
    """Cache log returns in context (computed once per pipeline run)."""
    if "log_ret" not in ctx:
        ctx["log_ret"] = np.log(close).diff()
    return ctx["log_ret"]


def reversal_signal(window: int) -> Stage:
    """Cumulative log return over `window` days, used as reversal raw signal.

    Expects input wide = close prices. Writes log_ret to ctx for reuse.
    """
    def _stage(close: pd.DataFrame, ctx: dict) -> pd.DataFrame:
        log_ret = make_log_ret(ctx, close)
        return log_ret.rolling(window=window, min_periods=window).sum()
    return _stage
