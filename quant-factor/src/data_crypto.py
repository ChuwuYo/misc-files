"""Crypto data adapter — fetch OHLCV from Binance public API (no auth).

Binance is the most liquid crypto exchange and its public klines API
requires no authentication. We use spot pairs against USDT for the
"local-currency-equivalent" returns most factor research uses.

Hyperliquid / OKX adapters can plug in via the same to_long_panel schema
later — see the adapter pattern.
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.request
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd

# urllib.request used inside funding fetcher too
_ = urllib.request


CACHE_DIR = Path(__file__).resolve().parent.parent / "data_cache"
CACHE_DIR.mkdir(exist_ok=True)


# Top-50 liquid Binance USDT spot pairs (manually curated, sector-diversified
# across L1, L2, DeFi, meme, infra). All have 3+ years of history.
BINANCE_TOP50 = [
    # L1 majors
    "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "AVAX", "DOT", "TRX", "TON",
    # L1/L2 / smart contract
    "ATOM", "NEAR", "ALGO", "FIL", "ICP", "ETC", "XLM", "VET", "EGLD", "HBAR",
    # DeFi blue-chips
    "UNI", "LINK", "AAVE", "MKR", "COMP", "SUSHI", "CRV", "SNX", "1INCH", "DYDX",
    # Layer-2 / rollups
    "ARB", "OP", "MATIC",
    # Memes
    "DOGE", "SHIB",
    # Storage / privacy / oracles
    "GRT", "FTM", "RUNE",
    # Exchange / utility
    "CAKE", "QNT", "SAND", "MANA", "AXS", "GALA", "CHZ", "ENJ", "APT", "INJ",
    "RNDR",
]


def _binance_klines(
    symbol: str, interval: str = "1d", start_ms: int | None = None, end_ms: int | None = None
) -> list[list]:
    """Single-call Binance kline fetch (max 1000 bars per call)."""
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={interval}&limit=1000"
    if start_ms is not None:
        url += f"&startTime={start_ms}"
    if end_ms is not None:
        url += f"&endTime={end_ms}"
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def _fetch_one_pair_full(
    symbol: str, interval: str, start_ms: int, end_ms: int, sleep_ms: int = 60
) -> pd.DataFrame:
    """Page through Binance until full range covered."""
    all_bars = []
    cursor = start_ms
    while cursor < end_ms:
        bars = _binance_klines(symbol, interval=interval, start_ms=cursor, end_ms=end_ms)
        if not bars:
            break
        all_bars.extend(bars)
        last_ts = bars[-1][0]
        if last_ts == cursor:  # no progress, stop
            break
        cursor = last_ts + 1
        if len(bars) < 1000:
            break
        time.sleep(sleep_ms / 1000.0)  # gentle on rate limits
    if not all_bars:
        return pd.DataFrame()
    df = pd.DataFrame(
        all_bars,
        columns=[
            "open_time", "open", "high", "low", "close", "volume",
            "close_time", "quote_volume", "n_trades",
            "taker_buy_base", "taker_buy_quote", "ignore",
        ],
    )
    df["date"] = pd.to_datetime(df["open_time"], unit="ms")
    df["symbol"] = symbol
    for c in ("open", "high", "low", "close", "volume"):
        df[c] = pd.to_numeric(df[c])
    return df[["date", "symbol", "open", "high", "low", "close", "volume"]]


def fetch_binance(
    symbols: Sequence[str] = tuple(BINANCE_TOP50),
    interval: str = "1d",
    years: float = 3.0,
    quote: str = "USDT",
    use_cache: bool = True,
) -> pd.DataFrame:
    """Fetch a multi-symbol OHLCV panel from Binance, normalized to long format.

    Returns: long DataFrame (date, symbol, open, high, low, close, volume).
    `symbol` column carries the base asset (e.g. "BTC"), not the pair (BTCUSDT).
    Cached to data_cache/binance_<interval>_<years>y_<hash>.parquet.
    """
    syms = tuple(sorted(set(symbols)))
    tag = hashlib.md5(
        f"{','.join(syms)}|{interval}|{years}|{quote}".encode()
    ).hexdigest()[:10]
    cache = CACHE_DIR / f"binance_{interval}_{years}y_{tag}.parquet"
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    end_ms = int(time.time() * 1000)
    start_ms = end_ms - int(years * 365.25 * 24 * 3600 * 1000)

    parts = []
    failed = []
    for s in syms:
        pair = f"{s}{quote}"
        try:
            df = _fetch_one_pair_full(pair, interval, start_ms, end_ms)
            if not df.empty:
                df["symbol"] = s  # store base asset, not pair
                parts.append(df)
            else:
                failed.append(s)
        except Exception as e:
            failed.append(f"{s}({type(e).__name__})")

    if not parts:
        raise RuntimeError(f"no data fetched; all symbols failed: {failed}")

    panel = pd.concat(parts, ignore_index=True)
    panel = panel.sort_values(["symbol", "date"]).reset_index(drop=True)
    panel.to_parquet(cache)
    if failed:
        print(f"[fetch_binance] {len(failed)} pairs failed: {failed[:10]}{'...' if len(failed)>10 else ''}")
    return panel


# Manually curated sector classification for BINANCE_TOP50.
# Sources cross-checked: CoinMarketCap categories, Messari sectors,
# Binance Research notes. A coin can technically belong to multiple categories;
# we pick the *primary* for sector-neutralization purposes.
CRYPTO_SECTOR_MAP = {
    # L1 majors (high-cap blockchain platforms)
    "BTC": "L1_Major", "ETH": "L1_Major", "BNB": "L1_Major",
    "SOL": "L1_Major", "XRP": "L1_Major", "ADA": "L1_Major",
    "AVAX": "L1_Major", "TRX": "L1_Major", "DOT": "L1_Major",
    # L1 alt (smaller / next-gen L1)
    "ATOM": "L1_Alt", "NEAR": "L1_Alt", "ALGO": "L1_Alt",
    "ICP": "L1_Alt", "ETC": "L1_Alt", "EGLD": "L1_Alt",
    "HBAR": "L1_Alt", "FTM": "L1_Alt", "TON": "L1_Alt",
    "APT": "L1_Alt", "INJ": "L1_Alt",
    # L2 / scaling / rollups
    "ARB": "L2", "OP": "L2", "MATIC": "L2",
    # DeFi blue-chips
    "UNI": "DeFi", "AAVE": "DeFi", "MKR": "DeFi",
    "COMP": "DeFi", "SUSHI": "DeFi", "CRV": "DeFi",
    "SNX": "DeFi", "1INCH": "DeFi", "DYDX": "DeFi",
    "CAKE": "DeFi", "RUNE": "DeFi",
    # Oracles / infrastructure
    "LINK": "Infra", "GRT": "Infra", "QNT": "Infra",
    "FIL": "Infra", "RNDR": "Infra",
    # Memes
    "DOGE": "Meme", "SHIB": "Meme",
    # Gaming / metaverse / NFT
    "SAND": "Gaming", "MANA": "Gaming", "AXS": "Gaming",
    "GALA": "Gaming", "CHZ": "Gaming", "ENJ": "Gaming",
    # Payments / privacy / utility
    "XLM": "Payments", "VET": "Payments",
}


def crypto_sector_series() -> pd.Series:
    """Return CRYPTO_SECTOR_MAP as a Series indexed by symbol."""
    return pd.Series(CRYPTO_SECTOR_MAP, name="sector")


def _binance_funding(symbol: str, start_ms: int, end_ms: int) -> list[dict]:
    """Fetch Binance perpetual funding events (max 1000 per call)."""
    url = (
        f"https://fapi.binance.com/fapi/v1/fundingRate?symbol={symbol}"
        f"&startTime={start_ms}&endTime={end_ms}&limit=1000"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())


def fetch_binance_funding(
    symbols: Sequence[str] = tuple(BINANCE_TOP50),
    years: float = 3.0,
    quote: str = "USDT",
    use_cache: bool = True,
) -> pd.DataFrame:
    """Fetch perpetual funding-rate history for a list of base assets.

    Returns a long DataFrame: date (daily), symbol, funding (daily mean of
    the 8-hour funding events). Binance perps fund every 8h → 3 fundings/day.

    Symbols without a USDT-M perpetual on Binance are skipped silently.
    """
    import hashlib
    import time as _time

    syms = tuple(sorted(set(symbols)))
    tag = hashlib.md5(f"funding|{','.join(syms)}|{years}|{quote}".encode()).hexdigest()[:10]
    cache = CACHE_DIR / f"binance_funding_{years}y_{tag}.parquet"
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    end_ms = int(_time.time() * 1000)
    start_ms = end_ms - int(years * 365.25 * 24 * 3600 * 1000)

    parts = []
    failed = []
    for s in syms:
        pair = f"{s}{quote}"
        bars = []
        cursor = start_ms
        try:
            while cursor < end_ms:
                chunk = _binance_funding(pair, cursor, end_ms)
                if not chunk:
                    break
                bars.extend(chunk)
                last = chunk[-1]["fundingTime"]
                if last == cursor:
                    break
                cursor = last + 1
                if len(chunk) < 1000:
                    break
                _time.sleep(0.06)
            if not bars:
                failed.append(s)
                continue
            df = pd.DataFrame(bars)
            df["date"] = pd.to_datetime(df["fundingTime"], unit="ms")
            df["funding"] = pd.to_numeric(df["fundingRate"])
            df["symbol"] = s
            # Daily aggregate: mean funding rate per calendar day.
            daily = (
                df.set_index("date")
                .groupby(pd.Grouper(freq="1D"))["funding"]
                .mean()
                .dropna()
                .reset_index()
            )
            daily["symbol"] = s
            parts.append(daily[["date", "symbol", "funding"]])
        except Exception as e:
            failed.append(f"{s}({type(e).__name__})")

    if not parts:
        raise RuntimeError(f"no funding fetched; failed: {failed}")
    out = pd.concat(parts, ignore_index=True).sort_values(["symbol", "date"])
    out.to_parquet(cache)
    if failed:
        print(f"[fetch_binance_funding] {len(failed)} skipped (no perp / error): {failed[:10]}")
    return out.reset_index(drop=True)


def join_funding_to_panel(panel: pd.DataFrame, funding: pd.DataFrame) -> pd.DataFrame:
    """Merge daily funding into an OHLCV panel. Adds a `funding` column;
    NaN where a symbol has no perp or no funding on that date.
    """
    panel = panel.copy()
    panel["date"] = pd.to_datetime(panel["date"])
    funding = funding.copy()
    funding["date"] = pd.to_datetime(funding["date"])
    # Both are at daily freq; left-join on (date, symbol).
    merged = panel.merge(funding, on=["date", "symbol"], how="left")
    return merged


def coverage_report(panel: pd.DataFrame) -> dict:
    return dict(
        n_rows=len(panel),
        n_symbols=panel["symbol"].nunique(),
        n_dates=panel["date"].nunique(),
        date_min=str(panel["date"].min().date()),
        date_max=str(panel["date"].max().date()),
        symbols_with_full_history=int(
            (panel.groupby("symbol")["date"].count() == panel["date"].nunique()).sum()
        ),
        nan_close=int(panel["close"].isna().sum()),
        zero_volume=int((panel["volume"] == 0).sum()),
        symbols_listed=sorted(panel["symbol"].unique()),
    )
