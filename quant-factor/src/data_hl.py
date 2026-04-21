"""Hyperliquid data adapter — fully public, no auth.

Hyperliquid (HL) advantages over Binance:
    - 229 perpetual contracts (vs ~49 we used from Binance)
    - 3-year daily candle history (same as Binance)
    - HOURLY funding history (vs Binance's 8-hour) — 24x finer granularity
    - Live OI snapshot via metaAndAssetCtxs (history not exposed publicly)

API: POST https://api.hyperliquid.xyz/info with JSON body.
Endpoint families used:
    - {"type": "meta"}                                    — list universe
    - {"type": "candleSnapshot", "req": {coin, interval, startTime, endTime}}
    - {"type": "fundingHistory", "coin", "startTime", "endTime"}
    - {"type": "metaAndAssetCtxs"}                        — current state
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


CACHE_DIR = Path(__file__).resolve().parent.parent / "data_cache"
CACHE_DIR.mkdir(exist_ok=True)

API_URL = "https://api.hyperliquid.xyz/info"


_LAST_CALL_TS = [0.0]
_MIN_INTERVAL = 0.25  # seconds between API calls globally — under Hyperliquid's public rate limit


def _throttle() -> None:
    now = time.time()
    elapsed = now - _LAST_CALL_TS[0]
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)
    _LAST_CALL_TS[0] = time.time()


def _post(body: dict, timeout: int = 30, max_retries: int = 4) -> dict | list:
    """POST with global throttle + exponential backoff on 429."""
    delay = 2.0
    for attempt in range(max_retries):
        _throttle()
        req = urllib.request.Request(
            API_URL,
            data=json.dumps(body).encode(),
            headers={"User-Agent": "curl/8", "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 1.5
                continue
            raise


def list_universe(use_cache: bool = True) -> list[str]:
    """Return list of perp coin names available on Hyperliquid."""
    cache = CACHE_DIR / "hl_universe.json"
    if use_cache and cache.exists():
        return json.loads(cache.read_text())
    meta = _post({"type": "meta"})
    universe = [u["name"] for u in meta.get("universe", [])]
    cache.write_text(json.dumps(universe))
    return universe


# Top-100 by 24h volume — fetched via metaAndAssetCtxs once, cached.
def list_top_by_volume(top_n: int = 100, use_cache: bool = True) -> list[str]:
    """Return the top-N coins by current 24h notional volume."""
    cache = CACHE_DIR / f"hl_top{top_n}_by_volume.json"
    if use_cache and cache.exists():
        return json.loads(cache.read_text())
    ctx = _post({"type": "metaAndAssetCtxs"})
    universe = [u["name"] for u in ctx[0]["universe"]]
    asset_ctxs = ctx[1]
    rows = []
    for name, ac in zip(universe, asset_ctxs):
        try:
            vol = float(ac.get("dayNtlVlm", 0))
        except (TypeError, ValueError):
            vol = 0
        rows.append((name, vol))
    rows.sort(key=lambda r: r[1], reverse=True)
    top = [r[0] for r in rows[:top_n]]
    cache.write_text(json.dumps(top))
    return top


def _candles_chunk(coin: str, interval: str, start_ms: int, end_ms: int) -> list[dict]:
    return _post({
        "type": "candleSnapshot",
        "req": {"coin": coin, "interval": interval, "startTime": start_ms, "endTime": end_ms},
    })


def _funding_chunk(coin: str, start_ms: int, end_ms: int) -> list[dict]:
    return _post({"type": "fundingHistory", "coin": coin, "startTime": start_ms, "endTime": end_ms})


def fetch_candles(
    symbols: Sequence[str],
    interval: str = "1d",
    years: float = 3.0,
    use_cache: bool = True,
) -> pd.DataFrame:
    """Fetch OHLCV candles from Hyperliquid for a list of perp symbols.

    Returns long DataFrame: date, symbol, open, high, low, close, volume.
    """
    syms = tuple(sorted(set(symbols)))
    tag = hashlib.md5(f"hl|{','.join(syms)}|{interval}|{years}".encode()).hexdigest()[:10]
    cache = CACHE_DIR / f"hl_candles_{interval}_{years}y_{tag}.parquet"
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    end_ms = int(time.time() * 1000)
    start_ms = end_ms - int(years * 365.25 * 24 * 3600 * 1000)

    parts = []
    failed = []
    for s in syms:
        try:
            chunk = _candles_chunk(s, interval, start_ms, end_ms)
            if not chunk:
                failed.append(s)
                continue
            df = pd.DataFrame(chunk)
            df["date"] = pd.to_datetime(df["t"], unit="ms")
            df["symbol"] = s
            for col_src, col_dst in [("o", "open"), ("h", "high"), ("l", "low"), ("c", "close"), ("v", "volume")]:
                df[col_dst] = pd.to_numeric(df[col_src])
            parts.append(df[["date", "symbol", "open", "high", "low", "close", "volume"]])
            time.sleep(0.05)  # rate-limit friendly
        except Exception as e:
            failed.append(f"{s}({type(e).__name__})")

    if not parts:
        raise RuntimeError(f"no HL candles fetched; failed: {failed}")
    out = pd.concat(parts, ignore_index=True).sort_values(["symbol", "date"]).reset_index(drop=True)
    out.to_parquet(cache)
    if failed:
        print(f"[fetch_candles HL] {len(failed)} failed: {failed[:10]}{'...' if len(failed)>10 else ''}")
    return out


def fetch_funding(
    symbols: Sequence[str],
    years: float = 3.0,
    aggregate_to: str = "1D",
    use_cache: bool = True,
) -> pd.DataFrame:
    """Fetch hourly funding from Hyperliquid for a list of perp symbols.

    `aggregate_to` controls output frequency: '1H' / '1D' / etc. Default '1D'
    aggregates 24 hourly fundings into a daily mean.

    Returns long DataFrame: date, symbol, funding.
    """
    syms = tuple(sorted(set(symbols)))
    tag = hashlib.md5(f"hl|funding|{','.join(syms)}|{years}|{aggregate_to}".encode()).hexdigest()[:10]
    cache = CACHE_DIR / f"hl_funding_{aggregate_to}_{years}y_{tag}.parquet"
    if use_cache and cache.exists():
        return pd.read_parquet(cache)

    end_ms = int(time.time() * 1000)
    start_ms = end_ms - int(years * 365.25 * 24 * 3600 * 1000)
    month_ms = 30 * 24 * 3600 * 1000

    parts = []
    failed = []
    for s in syms:
        events = []
        cursor = start_ms
        try:
            while cursor < end_ms:
                chunk = _funding_chunk(s, cursor, min(cursor + month_ms, end_ms))
                if not chunk:
                    cursor += month_ms
                    continue
                events.extend(chunk)
                last = chunk[-1]["time"]
                if last <= cursor:
                    cursor += month_ms
                else:
                    cursor = last + 1
                time.sleep(0.15)  # rate-limit friendly between paginated chunks
            if not events:
                failed.append(s)
                continue
            df = pd.DataFrame(events)
            df["date"] = pd.to_datetime(df["time"], unit="ms")
            df["funding"] = pd.to_numeric(df["fundingRate"])
            df = df.set_index("date")[["funding"]]
            agg = df.resample(aggregate_to).mean().dropna().reset_index()
            agg["symbol"] = s
            parts.append(agg[["date", "symbol", "funding"]])
        except Exception as e:
            failed.append(f"{s}({type(e).__name__})")

    if not parts:
        raise RuntimeError(f"no HL funding fetched; failed: {failed}")
    out = pd.concat(parts, ignore_index=True).sort_values(["symbol", "date"]).reset_index(drop=True)
    out.to_parquet(cache)
    if failed:
        print(f"[fetch_funding HL] {len(failed)} failed: {failed[:10]}{'...' if len(failed)>10 else ''}")
    return out


def join_funding(panel: pd.DataFrame, funding: pd.DataFrame) -> pd.DataFrame:
    """Left-join funding into an OHLCV panel."""
    panel = panel.copy()
    panel["date"] = pd.to_datetime(panel["date"])
    funding = funding.copy()
    funding["date"] = pd.to_datetime(funding["date"])
    return panel.merge(funding, on=["date", "symbol"], how="left")


def coverage_report(panel: pd.DataFrame) -> dict:
    return dict(
        n_rows=len(panel),
        n_symbols=panel["symbol"].nunique(),
        n_dates=panel["date"].nunique(),
        date_min=str(pd.to_datetime(panel["date"]).min().date()),
        date_max=str(pd.to_datetime(panel["date"]).max().date()),
        full_history=int(
            (panel.groupby("symbol")["date"].count() == panel["date"].nunique()).sum()
        ),
        nan_close=int(panel["close"].isna().sum()),
        zero_volume=int((panel["volume"] == 0).sum()),
        funding_coverage=(
            float(panel["funding"].notna().mean()) if "funding" in panel.columns else None
        ),
    )
