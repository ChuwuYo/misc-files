"""Alpha library — vectorized operators + Alpha101 subset.

Operators (ts_*, rank, correlation, delta, scale, ...) are direct
adaptations of WorldQuant Alpha101 primitives, see
`reference/WorldQuant_alpha101_code/101Alpha_code_1.py` for originals.

Each alpha takes a dict of wide DataFrames keyed by OHLCV field name and
returns a single wide DataFrame of signal values. We never apply `.neg`
inside an alpha — direction lives in the formula itself, just like
Kakushadze's originals (which often start with `-1 *`).
"""
from __future__ import annotations

from typing import Callable

import numpy as np
import pandas as pd

WideOHLCV = dict[str, pd.DataFrame]
Alpha = Callable[[WideOHLCV], pd.DataFrame]


# ---------- operator primitives ----------


def cs_rank(df: pd.DataFrame) -> pd.DataFrame:
    """Cross-sectional percentile rank per row, in [0, 1]."""
    return df.rank(axis=1, method="average", pct=True)


def ts_sum(df: pd.DataFrame, w: int) -> pd.DataFrame:
    return df.rolling(w, min_periods=w).sum()


def ts_mean(df: pd.DataFrame, w: int) -> pd.DataFrame:
    return df.rolling(w, min_periods=w).mean()


def ts_std(df: pd.DataFrame, w: int) -> pd.DataFrame:
    return df.rolling(w, min_periods=w).std()


def ts_min(df: pd.DataFrame, w: int) -> pd.DataFrame:
    return df.rolling(w, min_periods=w).min()


def ts_max(df: pd.DataFrame, w: int) -> pd.DataFrame:
    return df.rolling(w, min_periods=w).max()


def ts_argmax(df: pd.DataFrame, w: int) -> pd.DataFrame:
    """Index (0..w-1) of the maximum value in the trailing w-window."""
    arr = df.to_numpy()
    n, k = arr.shape
    out = np.full_like(arr, np.nan, dtype=float)
    for i in range(w - 1, n):
        win = arr[i - w + 1 : i + 1]
        out[i] = np.argmax(win, axis=0).astype(float)
    return pd.DataFrame(out, index=df.index, columns=df.columns)


def ts_rank(df: pd.DataFrame, w: int) -> pd.DataFrame:
    """For each cell, the rank of today's value within the trailing w-window
    (1 = lowest, w = highest), normalized to [0, 1].
    """
    return (
        df.rolling(w, min_periods=w)
        .apply(lambda x: pd.Series(x).rank(method="average").iloc[-1] / len(x), raw=False)
    )


def delta(df: pd.DataFrame, p: int = 1) -> pd.DataFrame:
    return df.diff(p)


def delay(df: pd.DataFrame, p: int = 1) -> pd.DataFrame:
    return df.shift(p)


def correlation(x: pd.DataFrame, y: pd.DataFrame, w: int) -> pd.DataFrame:
    """Per-cell rolling Pearson correlation between two wide frames."""
    xr = x.rolling(w, min_periods=w)
    return xr.corr(y).replace([np.inf, -np.inf], np.nan)


def signed_power(x: pd.DataFrame, p: float) -> pd.DataFrame:
    return np.sign(x) * (x.abs() ** p)


def returns_from_close(close: pd.DataFrame) -> pd.DataFrame:
    return close.pct_change()


def scale(df: pd.DataFrame, a: float = 1.0) -> pd.DataFrame:
    """L1-scale: rescale per row so abs values sum to a."""
    return df.div(df.abs().sum(axis=1).replace(0, np.nan), axis=0) * a


# ---------- alpha101 subset ----------


def alpha001(o: WideOHLCV) -> pd.DataFrame:
    """Alpha#1: rank(ts_argmax(SignedPower(returns<0 ? std20 : close, 2), 5)) - 0.5

    Volatility-conditioned momentum spike location.
    """
    close = o["close"]
    rets = returns_from_close(close)
    inner = close.copy()
    std20 = ts_std(rets, 20)
    inner = inner.where(rets >= 0, std20)
    sp = signed_power(inner, 2.0)
    return cs_rank(ts_argmax(sp, 5)) - 0.5


def alpha004(o: WideOHLCV) -> pd.DataFrame:
    """Alpha#4: -1 * ts_rank(rank(low), 9)

    Sustained-low reversal: persistent lowest-rank low -> expected bounce.
    """
    return -ts_rank(cs_rank(o["low"]), 9)


def alpha006(o: WideOHLCV) -> pd.DataFrame:
    """Alpha#6: -1 * correlation(open, volume, 10)

    Open-volume decoupling: when open and volume diverge over 10 bars,
    flag potential reversal.
    """
    return -correlation(o["open"], o["volume"].astype(float), 10).fillna(0)


def alpha012(o: WideOHLCV) -> pd.DataFrame:
    """Alpha#12: sign(delta(volume, 1)) * (-1 * delta(close, 1))

    Classic 'volume confirms reversal': rising volume with falling close = bullish next bar.
    """
    return np.sign(delta(o["volume"].astype(float), 1)) * (-delta(o["close"], 1))


# ---------- v0.2 reversal as an alpha for uniform interface ----------


def reversal_v02(o: WideOHLCV, window: int = 5, vol_window: int = 20, alpha: float = 1.0) -> pd.DataFrame:
    """Our v0.2 vol-dampened reversal, packaged as an alpha for the pool.

    Returns SIGNED z-scores (no rank, no neg) — combiner handles normalization.
    """
    close = o["close"]
    log_ret = np.log(close).diff()
    cum = log_ret.rolling(window, min_periods=window).sum()
    vol = log_ret.rolling(vol_window, min_periods=vol_window).std()
    vol_rank = vol.rank(axis=1, method="average", pct=True)
    weight = 1.0 / (1.0 + alpha * vol_rank)
    raw = -cum * weight  # neg here = reversal direction baked in
    return raw


# ---------- Qlib KBAR family (Alpha158) ----------
# Source: reference/qlib/qlib/contrib/data/loader.py:104-126
# These are STATE features without inherent direction — combiner learns sign.

EPS = 1e-12


def kmid(o: WideOHLCV) -> pd.DataFrame:
    """KMID = (close-open)/open — body direction (signed)."""
    return (o["close"] - o["open"]) / o["open"]


def klen(o: WideOHLCV) -> pd.DataFrame:
    """KLEN = (high-low)/open — bar full length (relative range)."""
    return (o["high"] - o["low"]) / o["open"]


def kmid2(o: WideOHLCV) -> pd.DataFrame:
    """KMID2 = (close-open)/(high-low+ε) — body fraction of range."""
    return (o["close"] - o["open"]) / (o["high"] - o["low"] + EPS)


def kup(o: WideOHLCV) -> pd.DataFrame:
    """KUP = (high - max(open,close))/open — upper shadow length."""
    upper_body = pd.concat([o["open"], o["close"]]).groupby(level=0).max()
    upper_body = o["open"].combine(o["close"], np.maximum)
    return (o["high"] - upper_body) / o["open"]


def kup2(o: WideOHLCV) -> pd.DataFrame:
    upper_body = o["open"].combine(o["close"], np.maximum)
    return (o["high"] - upper_body) / (o["high"] - o["low"] + EPS)


def klow(o: WideOHLCV) -> pd.DataFrame:
    """KLOW = (min(open,close)-low)/open — lower shadow length."""
    lower_body = o["open"].combine(o["close"], np.minimum)
    return (lower_body - o["low"]) / o["open"]


def klow2(o: WideOHLCV) -> pd.DataFrame:
    lower_body = o["open"].combine(o["close"], np.minimum)
    return (lower_body - o["low"]) / (o["high"] - o["low"] + EPS)


def ksft(o: WideOHLCV) -> pd.DataFrame:
    """KSFT = (2*close-high-low)/open — close shift from range midpoint."""
    return (2 * o["close"] - o["high"] - o["low"]) / o["open"]


def ksft2(o: WideOHLCV) -> pd.DataFrame:
    return (2 * o["close"] - o["high"] - o["low"]) / (o["high"] - o["low"] + EPS)


# ---------- Qlib volume / price-volume / range-position alphas ----------


def rsv20(o: WideOHLCV) -> pd.DataFrame:
    """RSV20 = (close-min(low,20))/(max(high,20)-min(low,20)+ε) — KDJ-style range position."""
    lo20 = ts_min(o["low"], 20)
    hi20 = ts_max(o["high"], 20)
    return (o["close"] - lo20) / (hi20 - lo20 + EPS)


def corr20_close_volume(o: WideOHLCV) -> pd.DataFrame:
    """CORR20 = corr(close, log(volume), 20)."""
    log_vol = np.log(o["volume"].astype(float) + 1.0)
    return correlation(o["close"], log_vol, 20).fillna(0)


def cord20_dret_dvol(o: WideOHLCV) -> pd.DataFrame:
    """CORD20 = corr(close/close.shift(1), log(volume/volume.shift(1)+1), 20)."""
    pr_chg = o["close"] / o["close"].shift(1)
    vr = o["volume"].astype(float) / o["volume"].shift(1).astype(float)
    log_vr = np.log(vr.replace([np.inf, -np.inf], np.nan) + 1.0).fillna(0)
    return correlation(pr_chg, log_vr, 20).fillna(0)


# ---------- registry ----------


ALPHA_REGISTRY: dict[str, Alpha] = {
    # v0.2 baseline
    "reversal_v02": reversal_v02,
    # Alpha101 subset (v0.5)
    "alpha001": alpha001,
    "alpha004": alpha004,
    "alpha006": alpha006,
    "alpha012": alpha012,
    # Qlib KBAR (v0.6)
    "kmid": kmid,
    "klen": klen,
    "kmid2": kmid2,
    "kup": kup,
    "kup2": kup2,
    "klow": klow,
    "klow2": klow2,
    "ksft": ksft,
    "ksft2": ksft2,
    # Qlib volume / range (v0.6)
    "rsv20": rsv20,
    "corr20": corr20_close_volume,
    "cord20": cord20_dret_dvol,
}


# Convenience subsets for testing.
ALPHA_GROUPS = {
    "v02_baseline": ["reversal_v02"],
    "alpha101_subset": ["alpha001", "alpha004", "alpha006", "alpha012"],
    "kbar": ["kmid", "klen", "kmid2", "kup", "kup2", "klow", "klow2", "ksft", "ksft2"],
    "qlib_pv": ["rsv20", "corr20", "cord20"],
    "all": list(ALPHA_REGISTRY.keys()),
}
