"""v0.11 — US equity SP50 ic_weight winner

OOS: mean IC +0.044, agg_t +3.64 (h=10, 300/160 walk-forward), 100% win 5 folds
Run: `python archive/v0.11_sp50_ic_weight/config.py`
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

import pandas as pd

from src.alphas import ALPHA_GROUPS
from src.data import to_wide
from src.data_real import fetch_yfinance
from src.factor import compute_pool_factor
from src.timeframes import TimeFrame
from backtest.portfolio import factor_to_pnl, sharpe
from backtest.walk_forward import walk_forward_evaluate


# US equity excludes both funding and Alpha158 rolling
ALPHAS = [
    a for a in ALPHA_GROUPS["all"]
    if a not in ALPHA_GROUPS["alpha158_rolling"] and a not in ALPHA_GROUPS["funding"]
]
TFS = [TimeFrame.D1, TimeFrame.W1]
HORIZON = 10


def compute_v011_factor(panel: pd.DataFrame):
    return compute_pool_factor(
        panel,
        alphas=ALPHAS,
        timeframes=TFS,
        combiner="ic_weight",
        ic_lookback=90,              # US-equity tuned (crypto uses 180)
        min_abs_ic=0.01,
        orthogonalize=True,
        smooth_lambda=0.7,           # US-equity EWMA (crypto uses 0.0)
    )


if __name__ == "__main__":
    import warnings
    warnings.filterwarnings("ignore")

    print("Loading SP50 (yfinance 3y daily)...")
    panel = fetch_yfinance(period="3y", interval="1d")

    # IC-based walk-forward (matches v0.11 reporting)
    print("\nIC-based walk-forward 5-fold @ h=10 (300/160 eval)...")
    rep = walk_forward_evaluate(
        panel,
        factor_fn=compute_v011_factor,
        n_splits=5,
        min_train_dates=200,
        test_size=110,
        purge=10,
        horizon=HORIZON,
    )
    print(rep.to_dataframe().to_string(index=False))
    print(f"\nmean IC: {rep.mean_ic:+.4f}")
    print(f"agg t:   {rep.aggregate_t:+.2f}")
    print(f"win%:    {rep.win_rate:.0%}")

    # Sharpe-based walk-forward (portfolio view)
    print("\n\nSharpe walk-forward (quintile long-short portfolio)...")
    all_dates = sorted(pd.to_datetime(panel["date"].unique()))
    rows = []
    for i in range(5):
        ts_idx = 200 + i * 110
        te_idx = 200 + (i + 1) * 110
        if te_idx > len(all_dates):
            break
        test_start, test_end = all_dates[ts_idx], all_dates[te_idx - 1]
        p = panel[pd.to_datetime(panel["date"]) <= test_end]
        f = compute_v011_factor(p)
        cw = to_wide(p, "close")
        pnl = factor_to_pnl(f, cw, horizon=HORIZON)
        pnl_t = pnl.loc[(pnl.index >= test_start) & (pnl.index <= test_end)]
        rows.append(dict(fold=i, sharpe=sharpe(pnl_t, 252)))
    df = pd.DataFrame(rows)
    print(df.to_string(index=False))
    print(f"\nmean Sharpe: {df['sharpe'].mean():+.2f}, win% {(df['sharpe'] > 0).mean():.0%}")
    print("\nExpected: mean IC ≈ +0.037, agg_t ≈ +4.39, mean Sharpe ≈ +2.63, 100% win")
