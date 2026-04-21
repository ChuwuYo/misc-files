"""v0.18 — Crypto ic_weight + funding baseline (no ML dependency)

OOS: mean Sharpe +2.24 (300/160 eval) / +3.37 (400/120 eval), 100% win
Run: `python archive/v0.18_binance_ic_funding/config.py`
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

import pandas as pd

from src.alphas import ALPHA_GROUPS
from src.data import to_wide
from src.data_crypto import fetch_binance, fetch_binance_funding, join_funding_to_panel
from src.factor import compute_pool_factor
from src.timeframes import TimeFrame
from backtest.portfolio import factor_to_pnl, sharpe


ALPHAS = [a for a in ALPHA_GROUPS["all"] if a not in ALPHA_GROUPS["alpha158_rolling"]]
TFS = [TimeFrame.D1, TimeFrame.W1]
HORIZON = 20


def compute_v018_factor(panel: pd.DataFrame):
    return compute_pool_factor(
        panel,
        alphas=ALPHAS,
        timeframes=TFS,
        combiner="ic_weight",
        ic_lookback=180,
        min_abs_ic=0.01,
        orthogonalize=True,
        smooth_lambda=0.0,   # crypto-tuned (equity uses 0.7)
    )


def walk_forward(panel: pd.DataFrame, min_train=400, test_size=120, n_splits=5, ppy=365):
    all_dates = sorted(pd.to_datetime(panel["date"].unique()))
    rows = []
    for i in range(n_splits):
        ts_idx = min_train + i * test_size
        te_idx = min_train + (i + 1) * test_size
        if te_idx > len(all_dates):
            break
        test_start, test_end = all_dates[ts_idx], all_dates[te_idx - 1]
        p = panel[pd.to_datetime(panel["date"]) <= test_end]
        f = compute_v018_factor(p)
        cw = to_wide(p, "close")
        pnl = factor_to_pnl(f, cw, horizon=HORIZON)
        pnl_t = pnl.loc[(pnl.index >= test_start) & (pnl.index <= test_end)]
        rows.append(dict(fold=i, test_end=str(test_end.date()), sharpe=sharpe(pnl_t, ppy)))
    return pd.DataFrame(rows)


if __name__ == "__main__":
    import warnings
    warnings.filterwarnings("ignore")

    print("Loading Binance 45 + funding...")
    panel = join_funding_to_panel(
        fetch_binance(years=3.0, interval="1d"),
        fetch_binance_funding(years=3.0),
    )
    df = walk_forward(panel)
    print(df.to_string(index=False))
    print(f"\nmean Sharpe: {df['sharpe'].mean():+.2f}")
    print(f"min fold:    {df['sharpe'].min():+.2f}")
    print(f"win rate:    {(df['sharpe'] > 0).mean():.0%}")
    print("\nExpected: mean ≈ +3.37, min ≈ +1.39, win = 100%")
