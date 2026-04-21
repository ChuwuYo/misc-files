"""Real-data adapters — fetch OHLCV from external sources, normalize to
the long-format panel used everywhere else in this project.

Currently supports yfinance (no auth). Future adapters (akshare for A-share,
ccxt for crypto) plug into the same `to_long_panel` schema.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Sequence

import numpy as np
import pandas as pd


CACHE_DIR = Path(__file__).resolve().parent.parent / "data_cache"
CACHE_DIR.mkdir(exist_ok=True)


# Top-50 S&P-100-style universe (large-cap, sector-diversified, 5y+ listed).
SP50 = [
    # Tech
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "ORCL", "ADBE", "CRM", "AVGO",
    "CSCO", "INTC", "QCOM", "TXN", "AMD", "IBM",
    # Finance
    "JPM", "BAC", "WFC", "C", "MS", "GS", "AXP", "BLK",
    # Consumer
    "WMT", "HD", "MCD", "NKE", "DIS", "SBUX", "KO", "PEP", "PG", "COST", "TGT",
    # Healthcare
    "JNJ", "UNH", "PFE", "MRK", "ABBV", "LLY", "TMO",
    # Energy / Industrial
    "XOM", "CVX", "BA", "CAT", "GE", "LMT", "HON", "UNP", "UPS",
]


def fetch_yfinance(
    symbols: Sequence[str] = tuple(SP50),
    period: str = "3y",
    interval: str = "1d",
    use_cache: bool = True,
    cache_tag: str | None = None,
) -> pd.DataFrame:
    """Fetch OHLCV from Yahoo Finance, return long panel.

    Long panel: columns = date, symbol, open, high, low, close, volume.
    Columns are renamed to lowercase for project consistency.

    Caches the wide multi-index DataFrame to a parquet file under
    `data_cache/` keyed by (period, interval, sorted-symbols hash) so
    we don't re-hit the network every iteration.
    """
    import hashlib

    syms = tuple(sorted(set(symbols)))
    tag = cache_tag or hashlib.md5(
        f"{','.join(syms)}|{period}|{interval}".encode()
    ).hexdigest()[:10]
    cache = CACHE_DIR / f"yfin_{interval}_{period}_{tag}.parquet"

    if use_cache and cache.exists():
        wide = pd.read_parquet(cache)
    else:
        import yfinance as yf
        wide = yf.download(
            tickers=list(syms),
            period=period,
            interval=interval,
            progress=False,
            auto_adjust=False,
            threads=True,
            group_by="column",
        )
        wide.columns.names = ["field", "symbol"]
        wide = wide.dropna(how="all")
        wide.to_parquet(cache)

    return _wide_yf_to_long(wide)


def _wide_yf_to_long(wide: pd.DataFrame) -> pd.DataFrame:
    """yfinance MultiIndex(field, symbol) wide -> long panel."""
    fields = ["Open", "High", "Low", "Close", "Volume"]
    parts = []
    for f in fields:
        if f in wide.columns.get_level_values(0):
            sub = wide[f].stack().rename(f.lower())
            parts.append(sub)
    long = pd.concat(parts, axis=1).reset_index()
    long.columns = [c.lower() if c in ("Date", "Datetime") else c for c in long.columns]
    long = long.rename(columns={"Date": "date", "Datetime": "date", "Ticker": "symbol", "ticker": "symbol"})
    long["volume"] = long["volume"].fillna(0).astype(np.int64)
    long["date"] = pd.to_datetime(long["date"])
    long = long.sort_values(["symbol", "date"]).reset_index(drop=True)
    return long[["date", "symbol", "open", "high", "low", "close", "volume"]]


def coverage_report(panel: pd.DataFrame) -> dict:
    """Quick QA on a fetched panel."""
    return dict(
        n_rows=len(panel),
        n_symbols=panel["symbol"].nunique(),
        n_dates=panel["date"].nunique(),
        date_min=str(panel["date"].min().date()),
        date_max=str(panel["date"].max().date()),
        symbols_with_full_history=int(
            (panel.groupby("symbol")["date"].count() == panel["date"].nunique()).sum()
        ),
        nan_open=int(panel["open"].isna().sum()),
        nan_close=int(panel["close"].isna().sum()),
        zero_volume=int((panel["volume"] == 0).sum()),
    )
