"""v0.23 — LGBM rank_target + raw_features breakthrough (92/8 ensemble)

OOS: mean Sharpe +2.46, 100% win 4/4 folds (300/160 eval)
Run: `python archive/v0.23_lgbm_breakthrough/config.py`
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

import pandas as pd

from src.alphas import ALPHA_GROUPS, ALPHA_REGISTRY
from src.data import to_wide
from src.data_crypto import fetch_binance, fetch_binance_funding, join_funding_to_panel
from src.factor import compute_pool_factor
from src.lgbm_combiner import lgbm_combine
from src.timeframes import LEFT_LABELED_TFS, TimeFrame, resample_panel
from backtest.portfolio import factor_to_pnl, sharpe


ALPHAS = [a for a in ALPHA_GROUPS["all"] if a not in ALPHA_GROUPS["alpha158_rolling"]]
TFS = [TimeFrame.D1, TimeFrame.W1]
HORIZON = 20
W_LGBM = 0.08  # 92/8 ensemble (v0.23 canonical; v0.24 uses 0.15 at 400/120)


def build_features(panel, alphas=ALPHAS, tfs=TFS):
    finest = TimeFrame.D1
    features = {}
    for tf in tfs:
        rs = resample_panel(panel, tf)
        fields = ["open", "high", "low", "close", "volume"]
        if "funding" in rs.columns:
            fields.append("funding")
        ohlcv = {f: to_wide(rs, field=f) for f in fields if f in rs.columns}
        cw_finest = to_wide(resample_panel(panel, finest), "close")
        for name in alphas:
            sig = ALPHA_REGISTRY[name](ohlcv)
            if tf is not finest and tf in LEFT_LABELED_TFS:
                sig = sig.shift(1)
            features[f"{name}@{tf.name}"] = sig.reindex(cw_finest.index).ffill()
    return features


def compute_v023_ensemble_pnl(panel):
    cw = to_wide(panel, "close")
    f_ic = compute_pool_factor(
        panel, alphas=ALPHAS, timeframes=TFS, combiner="ic_weight",
        ic_lookback=180, min_abs_ic=0.01, orthogonalize=True,
    )
    feats = build_features(panel)
    f_lg = lgbm_combine(
        feats, cw, horizon=HORIZON, refit_every=10,
        rank_target=True, rank_features=False,          # ← key
        min_train_obs=1000,
        max_depth=2, n_estimators=300, learning_rate=0.05, reg_lambda=10.0,
    )
    pnl_ic = factor_to_pnl(f_ic, cw, horizon=HORIZON)
    pnl_lg = factor_to_pnl(f_lg, cw, horizon=HORIZON)
    idx = pnl_ic.index.union(pnl_lg.index)
    return (1 - W_LGBM) * pnl_ic.reindex(idx).fillna(0) + W_LGBM * pnl_lg.reindex(idx).fillna(0)


if __name__ == "__main__":
    import warnings
    warnings.filterwarnings("ignore")

    print("Loading Binance 45 + funding...")
    panel = join_funding_to_panel(
        fetch_binance(years=3.0, interval="1d"),
        fetch_binance_funding(years=3.0),
    )

    print("\nWalk-forward 4-fold @ h=20 (300/160 eval)...")
    all_dates = sorted(pd.to_datetime(panel["date"].unique()))
    rows = []
    for i in range(5):
        ts_idx = 300 + i * 160
        te_idx = 300 + (i + 1) * 160
        if te_idx > len(all_dates):
            break
        test_start, test_end = all_dates[ts_idx], all_dates[te_idx - 1]
        p = panel[pd.to_datetime(panel["date"]) <= test_end]
        pnl = compute_v023_ensemble_pnl(p)
        pnl_t = pnl.loc[(pnl.index >= test_start) & (pnl.index <= test_end)]
        rows.append(dict(fold=i, sharpe=sharpe(pnl_t, 365)))
    df = pd.DataFrame(rows)
    print(df.to_string(index=False))
    print(f"\nmean: {df['sharpe'].mean():+.2f}, min: {df['sharpe'].min():+.2f}, win%: {(df['sharpe'] > 0).mean():.0%}")
    print("Expected: mean ≈ +2.46, min ≈ +0.05, 100% win")
