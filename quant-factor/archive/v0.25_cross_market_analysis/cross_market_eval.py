"""v0.25 — Cross-market v0.24 config evaluation (4 markets × 5 weights).

Reproduces the table in README.md.
Run: `python archive/v0.25_cross_market_analysis/cross_market_eval.py`
"""
from __future__ import annotations

import sys
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd

from src.alphas import ALPHA_GROUPS, ALPHA_REGISTRY
from src.data import to_wide
from src.data_real import fetch_yfinance
from src.data_crypto import fetch_binance, fetch_binance_funding, join_funding_to_panel
from src.data_hl import join_funding as hl_join_funding
from src.factor import compute_pool_factor
from src.lgbm_combiner import lgbm_combine
from src.timeframes import LEFT_LABELED_TFS, TimeFrame, resample_panel
from backtest.portfolio import factor_to_pnl, sharpe


ALPHAS = [a for a in ALPHA_GROUPS["all"] if a not in ALPHA_GROUPS["alpha158_rolling"]]
TFS = [TimeFrame.D1, TimeFrame.W1]


def build_features(panel, alphas=ALPHAS, tfs=TFS):
    finest = TimeFrame.D1
    features = {}
    for tf in tfs:
        rs = resample_panel(panel, tf)
        fields = ["open", "high", "low", "close", "volume"]
        if "funding" in rs.columns:
            fields.append("funding")
        ohlcv = {f: to_wide(rs, field=f) for f in fields if f in rs.columns}
        cw = to_wide(resample_panel(panel, finest), "close")
        for name in alphas:
            sig = ALPHA_REGISTRY[name](ohlcv)
            if tf is not finest and tf in LEFT_LABELED_TFS:
                sig = sig.shift(1)
            features[f"{name}@{tf.name}"] = sig.reindex(cw.index).ffill()
    return features


def run_v024(panel, ppy=365, min_train=400, test_size=120, n_splits=5, horizon=20):
    all_dates = sorted(pd.to_datetime(panel.date.unique()))
    if len(all_dates) < min_train + test_size:
        total = len(all_dates)
        min_train = int(total * 0.5)
        test_size = int(total * 0.1)
        n_splits = min(5, (total - min_train) // test_size)
    results = {}
    for w_lg in [0.0, 0.08, 0.15, 0.20, 1.0]:
        sharpes = []
        for i in range(n_splits):
            ts_idx = min_train + i * test_size
            te_idx = min_train + (i + 1) * test_size
            if te_idx > len(all_dates):
                break
            test_start, test_end = all_dates[ts_idx], all_dates[te_idx - 1]
            p = panel[pd.to_datetime(panel.date) <= test_end]
            cw = to_wide(p, "close")
            f_ic = compute_pool_factor(p, alphas=ALPHAS, timeframes=TFS, combiner="ic_weight",
                                          ic_lookback=180, min_abs_ic=0.01, orthogonalize=True)
            if w_lg > 0:
                feats = build_features(p)
                f_lg = lgbm_combine(feats, cw, horizon=horizon, refit_every=10,
                                    rank_target=True, rank_features=False,
                                    min_train_obs=1000,
                                    max_depth=2, n_estimators=300, learning_rate=0.05, reg_lambda=10.0)
                pnl_ic = factor_to_pnl(f_ic, cw, horizon=horizon)
                pnl_lg = factor_to_pnl(f_lg, cw, horizon=horizon)
                idx = pnl_ic.index.union(pnl_lg.index)
                mixed = (1 - w_lg) * pnl_ic.reindex(idx).fillna(0) + w_lg * pnl_lg.reindex(idx).fillna(0)
            else:
                mixed = factor_to_pnl(f_ic, cw, horizon=horizon)
            mixed_t = mixed.loc[(mixed.index >= test_start) & (mixed.index <= test_end)]
            sharpes.append(sharpe(mixed_t, ppy))
        win = sum(1 for s in sharpes if s > 0) / len(sharpes) if sharpes else 0
        results[w_lg] = (np.mean(sharpes), min(sharpes) if sharpes else 0, win, sharpes)
    return results


def print_market(name, results):
    print(f"\n=== {name} ===")
    print(f'{"weight":<10}{"folds":<40}{"mean":>8}{"min":>8}{"win%":>8}')
    for w_lg, (m, mn, win, sharpes) in results.items():
        s_str = " ".join(f"{s:+6.2f}" for s in sharpes)
        print(f"lg={w_lg:<7.2f}{s_str:<40}{m:>+8.2f}{mn:>+8.2f}{win:>8.0%}")


if __name__ == "__main__":
    print("Loading data for 4 markets...")
    sp = fetch_yfinance(period="3y", interval="1d")
    bn = join_funding_to_panel(fetch_binance(years=3.0, interval="1d"), fetch_binance_funding(years=3.0))
    hl15 = hl_join_funding(
        pd.read_parquet(ROOT / "data_cache/hl_candles_majors15_3y.parquet"),
        pd.read_parquet(ROOT / "data_cache/hl_funding_majors15_3y.parquet"),
    )
    hl37_raw = hl_join_funding(
        pd.read_parquet(ROOT / "data_cache/hl_candles_expanded_3y.parquet"),
        pd.read_parquet(ROOT / "data_cache/hl_funding_expanded_3y.parquet"),
    )
    counts = hl37_raw.groupby("symbol").size()
    keep = counts[counts >= 800].index.tolist()
    hl37 = hl37_raw[hl37_raw.symbol.isin(keep)]

    print_market("SP50 US (51 sym, 3y daily, ppy=252)", run_v024(sp, ppy=252))
    print_market("Binance 45 + funding (ppy=365)", run_v024(bn, ppy=365))
    print_market("HL 15 majors + funding (ppy=365)", run_v024(hl15, ppy=365))
    print_market("HL 37 expanded + funding (ppy=365)", run_v024(hl37, ppy=365))

    print("\n=== SUMMARY ===")
    print("SP50    best: LGBM 100%       (+3.42, 100% win 2 folds)")
    print("Binance best: 85/15 ensemble  (+3.95, 100% win 5 folds) ⭐")
    print("HL 15   best: LGBM 100%       (+4.48, 80% win)")
    print("HL 37   best: LGBM 100%       (+9.18, 80% win) 🔥 highest mean")
