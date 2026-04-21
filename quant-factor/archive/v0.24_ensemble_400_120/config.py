"""v0.24 — FINAL WINNER (Crypto)

85/15 ic_weight / LGBM ensemble at 400/120 walk-forward.
mean Sharpe +3.95, 100% win 5/5 folds, min +0.38.

Run: `python archive/v0.24_ensemble_400_120/config.py`
(from the quant-factor project root)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd

from src.alphas import ALPHA_GROUPS, ALPHA_REGISTRY
from src.data import to_wide
from src.data_crypto import (
    fetch_binance,
    fetch_binance_funding,
    join_funding_to_panel,
)
from src.factor import compute_pool_factor
from src.lgbm_combiner import lgbm_combine
from src.timeframes import LEFT_LABELED_TFS, TimeFrame, resample_panel
from backtest.portfolio import factor_to_pnl, sharpe


# ---------- v0.24 canonical config ----------
ALPHAS_CORE = [a for a in ALPHA_GROUPS["all"] if a not in ALPHA_GROUPS["alpha158_rolling"]]
TFS = [TimeFrame.D1, TimeFrame.W1]
HORIZON = 20
W_LGBM = 0.15                       # 85/15 ic/LGBM ensemble
IC_LOOKBACK = 180
LGBM_PARAMS = dict(
    horizon=HORIZON,
    refit_every=10,
    rank_target=True,
    rank_features=False,            # ← key discovery from v0.23
    min_train_obs=1000,
    max_depth=2,
    n_estimators=300,
    learning_rate=0.05,
    reg_lambda=10.0,
)

# Walk-forward evaluation
WF_MIN_TRAIN = 400
WF_TEST_SIZE = 120
WF_N_SPLITS = 5


def build_features(panel: pd.DataFrame, alphas=ALPHAS_CORE, tfs=TFS) -> dict[str, pd.DataFrame]:
    """Construct (alpha × TF) feature dict for LGBM. Handles TF shift for
    left-labeled coarser TFs (avoids intraday / daily label lookahead).
    """
    finest = TimeFrame.D1
    features: dict[str, pd.DataFrame] = {}
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


def compute_v024_factors(panel: pd.DataFrame):
    """Produce the two component factors (ic_weight and LGBM) + the ensemble PnL."""
    cw = to_wide(panel, "close")
    # 1) ic_weight linear combiner
    f_ic = compute_pool_factor(
        panel,
        alphas=ALPHAS_CORE,
        timeframes=TFS,
        combiner="ic_weight",
        ic_lookback=IC_LOOKBACK,
        min_abs_ic=0.01,
        orthogonalize=True,
    )
    # 2) LightGBM non-linear combiner
    features = build_features(panel)
    f_lgbm = lgbm_combine(features, cw, **LGBM_PARAMS)
    # 3) 85/15 PnL ensemble
    pnl_ic = factor_to_pnl(f_ic, cw, horizon=HORIZON)
    pnl_lgbm = factor_to_pnl(f_lgbm, cw, horizon=HORIZON)
    idx = pnl_ic.index.union(pnl_lgbm.index)
    pnl_ensemble = (
        (1 - W_LGBM) * pnl_ic.reindex(idx).fillna(0)
        + W_LGBM * pnl_lgbm.reindex(idx).fillna(0)
    )
    return dict(ic=f_ic, lgbm=f_lgbm, pnl_ensemble=pnl_ensemble, pnl_ic=pnl_ic, pnl_lgbm=pnl_lgbm)


def walk_forward_report(panel: pd.DataFrame, ppy: int = 365) -> pd.DataFrame:
    """5-fold walk-forward evaluation — returns per-fold Sharpe for ic_only /
    LGBM-only / ensemble (85/15).
    """
    all_dates = sorted(pd.to_datetime(panel["date"].unique()))
    rows = []
    for i in range(WF_N_SPLITS):
        ts_idx = WF_MIN_TRAIN + i * WF_TEST_SIZE
        te_idx = WF_MIN_TRAIN + (i + 1) * WF_TEST_SIZE
        if te_idx > len(all_dates):
            break
        test_start = all_dates[ts_idx]
        test_end = all_dates[te_idx - 1]
        p_slice = panel[pd.to_datetime(panel["date"]) <= test_end]
        out = compute_v024_factors(p_slice)
        s_ic = sharpe(out["pnl_ic"].loc[(out["pnl_ic"].index >= test_start) & (out["pnl_ic"].index <= test_end)], ppy)
        s_lg = sharpe(out["pnl_lgbm"].loc[(out["pnl_lgbm"].index >= test_start) & (out["pnl_lgbm"].index <= test_end)], ppy)
        s_ens = sharpe(out["pnl_ensemble"].loc[(out["pnl_ensemble"].index >= test_start) & (out["pnl_ensemble"].index <= test_end)], ppy)
        rows.append(
            dict(
                fold=i,
                test_start=str(test_start.date()),
                test_end=str(test_end.date()),
                sharpe_ic=s_ic,
                sharpe_lgbm=s_lg,
                sharpe_ensemble_85_15=s_ens,
            )
        )
    df = pd.DataFrame(rows)
    summary = dict(
        mean_ic=df["sharpe_ic"].mean(),
        mean_lgbm=df["sharpe_lgbm"].mean(),
        mean_ensemble=df["sharpe_ensemble_85_15"].mean(),
        min_ensemble=df["sharpe_ensemble_85_15"].min(),
        win_ensemble=(df["sharpe_ensemble_85_15"] > 0).mean(),
    )
    return df, summary


if __name__ == "__main__":
    import warnings
    warnings.filterwarnings("ignore")

    print("Loading Binance 45 + funding (3y daily)...")
    panel = join_funding_to_panel(
        fetch_binance(years=3.0, interval="1d"),
        fetch_binance_funding(years=3.0),
    )
    print(f"  panel: {len(panel):,} rows, {panel['symbol'].nunique()} symbols")

    print("\nRunning walk-forward 5-fold @ h=20...")
    folds, summary = walk_forward_report(panel)
    print("\n=== per-fold Sharpe ===")
    print(folds.to_string(index=False))
    print("\n=== summary (Sharpe, ppy=365) ===")
    for k, v in summary.items():
        print(f"  {k}: {v:+.3f}" if isinstance(v, float) else f"  {k}: {v}")
    print(f"\nExpected: mean_ensemble ≈ +3.95, win_ensemble = 1.00, min_ensemble ≈ +0.38")
