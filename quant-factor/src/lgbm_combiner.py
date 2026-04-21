"""LightGBM combiner — non-linear alternative to ic_weight.

Replaces the linear `ic_weight` combiner with a gradient-boosted decision-tree
model that can learn feature INTERACTIONS (e.g. "klen matters more when
funding is positive") and regime-conditional behavior.

Lookahead defense:
    - Trained ONLY on data strictly before the test sample (walk-forward fit).
    - Forward returns used as target are aligned causally (no future leak).
    - Same shift(1) discipline as ic_weight applies — handled by walk-forward
      framework caller.

Output:
    Wide (date × symbol) factor — same interface as ic_weight combiner.
    Cross-sectionally rank-normalized to [-1, 1] for direct comparability.
"""
from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd

try:
    import lightgbm as lgb
    _HAS_LGBM = True
except Exception:
    _HAS_LGBM = False


def _stack_wide_to_long(
    signals: dict[str, pd.DataFrame],
) -> tuple[pd.DataFrame, pd.MultiIndex]:
    """Convert {name: wide(date×sym)} into a long DataFrame indexed by
    (date, symbol) with one column per signal name.
    """
    parts = []
    for name, df in signals.items():
        s = df.stack().rename(name)
        parts.append(s)
    long = pd.concat(parts, axis=1)
    long.index.set_names(["date", "symbol"], inplace=True)
    return long, long.index


def _causal_target(
    close_wide: pd.DataFrame, horizon: int, rank_target: bool = True
) -> pd.Series:
    """Long-format forward return (date, symbol) -> next-h pct return.

    With `rank_target=True` (default), transform to per-date cross-sectional
    rank percentile in [0, 1]. This is what ic_weight effectively optimizes
    and makes LightGBM robust to extreme return outliers (crypto).
    """
    fwd = close_wide.shift(-horizon) / close_wide - 1.0
    if rank_target:
        fwd = fwd.rank(axis=1, method="average", pct=True) - 0.5  # ∈ [-0.5, 0.5]
    return fwd.stack().rename("target")


def _train_predict_lgbm(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_predict: pd.DataFrame,
    n_estimators: int = 200,
    learning_rate: float = 0.05,
    max_depth: int = 5,
    num_leaves: int = 31,
    min_data_in_leaf: int = 50,
    seed: int = 42,
) -> np.ndarray:
    """Fit LightGBM on (X_train, y_train) and predict on X_predict.

    Returns flat numpy array of predictions.
    """
    if not _HAS_LGBM:
        raise ImportError("lightgbm not installed")
    model = lgb.LGBMRegressor(
        n_estimators=n_estimators,
        learning_rate=learning_rate,
        max_depth=max_depth,
        num_leaves=num_leaves,
        min_data_in_leaf=min_data_in_leaf,
        objective="regression",
        random_state=seed,
        verbose=-1,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    return model.predict(X_predict)


def lgbm_combine(
    signals: dict[str, pd.DataFrame],
    close_wide: pd.DataFrame,
    horizon: int = 10,
    train_lookback: int | None = None,
    refit_every: int = 30,
    min_train_obs: int = 5000,
    rank_target: bool = True,
    rank_features: bool = True,
    **lgbm_kwargs,
) -> pd.DataFrame:
    """Walk-forward LightGBM combiner.

    For each test date t:
        - train_end = t - horizon (purge to avoid forward-return overlap)
        - train_start = max(train_end - train_lookback, t0) [None means expanding]
        - fit on (date < train_end), predict for date == t
        - refit only every `refit_every` days for speed

    Args:
        signals: {alpha_name: wide DataFrame (date × symbol)}
        close_wide: aligned (date × symbol) close prices for target derivation
        horizon: forward-return horizon used as target
        train_lookback: bars to keep in training window (None=expanding)
        refit_every: re-train every N test bars (saves compute)
        min_train_obs: skip prediction until train set has ≥ this many rows

    Returns:
        Wide factor DataFrame (date × symbol), cross-sectionally rank-normalized to [-1, 1].
    """
    if not _HAS_LGBM:
        raise ImportError("lightgbm not installed; pip install lightgbm")

    # Optionally rank-transform features per-date to [-0.5, 0.5] — makes LGBM
    # scale-invariant and robust to outliers. Very helpful on crypto data.
    if rank_features:
        signals = {
            k: (v.rank(axis=1, method="average", pct=True) - 0.5)
            for k, v in signals.items()
        }

    # Stack signals into long-format feature matrix
    X_long, mi = _stack_wide_to_long(signals)
    y_long = _causal_target(close_wide, horizon=horizon, rank_target=rank_target)

    # Inner-join on (date, symbol) — drop rows with NaN in any feature
    df = X_long.join(y_long, how="inner").dropna()
    df = df.sort_index(level="date")

    all_dates = df.index.get_level_values("date").unique().sort_values()
    if len(all_dates) < 30:
        raise ValueError("not enough unique dates to walk-forward")

    feature_cols = [c for c in df.columns if c != "target"]

    pred_records = []
    cached_model = None
    cached_at = None

    for ti, t in enumerate(all_dates):
        # Train cutoff: only data with date < t - horizon (purge)
        train_cutoff = t - pd.Timedelta(days=horizon + 1)
        train_mask = df.index.get_level_values("date") < train_cutoff
        train_df = df[train_mask]
        if len(train_df) < min_train_obs:
            continue
        if train_lookback is not None:
            lower = train_cutoff - pd.Timedelta(days=train_lookback)
            train_df = train_df[train_df.index.get_level_values("date") >= lower]

        # Refit every `refit_every` test dates only
        need_refit = (cached_model is None) or (ti - cached_at >= refit_every)
        if need_refit:
            cached_model = lgb.LGBMRegressor(
                n_estimators=lgbm_kwargs.get("n_estimators", 200),
                learning_rate=lgbm_kwargs.get("learning_rate", 0.05),
                max_depth=lgbm_kwargs.get("max_depth", 5),
                num_leaves=lgbm_kwargs.get("num_leaves", 31),
                min_data_in_leaf=lgbm_kwargs.get("min_data_in_leaf", 50),
                reg_lambda=lgbm_kwargs.get("reg_lambda", 0.0),
                reg_alpha=lgbm_kwargs.get("reg_alpha", 0.0),
                feature_fraction=lgbm_kwargs.get("feature_fraction", 1.0),
                bagging_fraction=lgbm_kwargs.get("bagging_fraction", 1.0),
                bagging_freq=lgbm_kwargs.get("bagging_freq", 0),
                objective="regression",
                random_state=lgbm_kwargs.get("seed", 42),
                verbose=-1,
                n_jobs=-1,
            )
            cached_model.fit(train_df[feature_cols], train_df["target"])
            cached_at = ti

        # Predict for date == t
        test_mask = df.index.get_level_values("date") == t
        if not test_mask.any():
            continue
        test_df = df[test_mask]
        preds = cached_model.predict(test_df[feature_cols])
        for (date, sym), pv in zip(test_df.index, preds):
            pred_records.append((date, sym, float(pv)))

    if not pred_records:
        raise RuntimeError("LightGBM combiner produced no predictions")
    pred_df = pd.DataFrame(pred_records, columns=["date", "symbol", "prediction"])
    wide = pred_df.pivot(index="date", columns="symbol", values="prediction")

    # Cross-sectional rank to [-1, 1] for comparability with ic_weight output
    return (wide.rank(axis=1, pct=True) - 0.5) * 2.0
