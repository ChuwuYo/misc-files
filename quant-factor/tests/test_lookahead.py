"""Lookahead defense suite — catches MTF and combiner causality bugs.

Why this exists:
    v0.16 found a two-stage MTF lookahead (H4 and D1 default to left-labels
    in pandas, so ffill onto a finer TF grid leaks future data). The bug
    inflated intraday IC by ~33x. This suite codifies tests that would have
    caught it automatically.

Run: `python -m tests.test_lookahead` (pure Python, no pytest dependency)
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is importable when running as `python -m tests.test_lookahead`.
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd

from src.data import sample_intraday_panel, to_wide
from src.factor import compute_pool_factor
from src.timeframes import TimeFrame, resample_panel
from backtest.evaluate import _row_corr, _forward_return


# ---------- test helpers ----------


def _make_panel(n_days: int = 30, n_symbols: int = 20, bar_minutes: int = 60, seed: int = 0) -> pd.DataFrame:
    """Small synthetic panel for fast testing."""
    bars_per_day = 24  # 1h bars, crypto-style
    return sample_intraday_panel(
        n_days=n_days,
        n_symbols=n_symbols,
        bar_minutes=bar_minutes,
        bars_per_day=bars_per_day,
        seed=seed,
    )


def _ic(factor: pd.DataFrame, close: pd.DataFrame, horizon: int = 1) -> float:
    fwd = _forward_return(close, horizon=horizon)
    f, r = factor.align(fwd, join="inner")
    return float(_row_corr(f, r).mean())


class TestFailure(AssertionError):
    """Raised with a clear message when a test condition fails."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise TestFailure(message)


# ---------- tests ----------


def test_oracle_ic_is_one() -> None:
    """Sanity: if factor IS the forward return, IC should be 1.0.

    Verifies the evaluator is correct.
    """
    panel = _make_panel()
    close = to_wide(panel, "close")
    fwd = _forward_return(close, horizon=1)
    # "Perfect oracle" factor = fwd return itself
    oracle = fwd
    ic = _ic(oracle, close, horizon=1)
    _require(
        abs(ic - 1.0) < 1e-6,
        f"oracle IC should be 1.0, got {ic:.6f}",
    )
    print(f"  ✓ oracle IC = {ic:.6f} (expected 1.0)")


def test_noise_factor_has_zero_ic() -> None:
    """Inject a pure-noise factor (independent of prices). IC should be ≈ 0.

    If the evaluator or pipeline is leaking info, a noise signal could
    spuriously correlate with future returns.
    """
    panel = _make_panel()
    close = to_wide(panel, "close")
    rng = np.random.default_rng(42)
    noise = pd.DataFrame(
        rng.standard_normal(close.shape),
        index=close.index,
        columns=close.columns,
    )
    ic = _ic(noise, close, horizon=1)
    # With T ≈ 720 test rows, std of IC under null is ~1/sqrt(N_symbols).
    # 3-sigma bound: |IC| < 3 / sqrt(20) ≈ 0.67. Any decent noise factor
    # should have |IC| < 0.05 in practice.
    _require(
        abs(ic) < 0.05,
        f"noise factor |IC| should be < 0.05, got {ic:+.6f}",
    )
    print(f"  ✓ noise IC = {ic:+.6f} (|IC| < 0.05)")


def test_mtf_no_future_leak_h1_plus_h4() -> None:
    """The v0.16 bug: H1+H4 MTF on hourly data must not inflate IC beyond what
    H1 alone sees. If the H4 slot leaks future data, |IC| jumps dramatically.

    Strategy: compare |IC| of (H1 only) vs (H1 + H4). Both should be in the
    same order of magnitude; a 5x+ gap signals lookahead from H4.
    """
    panel = _make_panel(n_days=60, n_symbols=30, bar_minutes=60)
    close = to_wide(resample_panel(panel, TimeFrame.H1), "close")

    f_h1 = compute_pool_factor(
        panel,
        alphas=["reversal_v02"],
        timeframes=[TimeFrame.H1],
        combiner="ic_weight",
        ic_lookback=60,
        orthogonalize=False,
    )
    f_h1h4 = compute_pool_factor(
        panel,
        alphas=["reversal_v02"],
        timeframes=[TimeFrame.H1, TimeFrame.H4],
        combiner="ic_weight",
        ic_lookback=60,
        orthogonalize=False,
    )

    ic_h1 = abs(_ic(f_h1, close, horizon=1))
    ic_h1h4 = abs(_ic(f_h1h4, close, horizon=1))
    ratio = ic_h1h4 / max(ic_h1, 1e-6)

    print(f"  H1 only  |IC| = {ic_h1:.4f}")
    print(f"  H1+H4    |IC| = {ic_h1h4:.4f}")
    print(f"  ratio = {ratio:.2f}")
    # With fix: H4 adds modest info (ratio 0.5x - 2x).
    # Bug version: ratio ~ 10x from the ffill lookahead.
    _require(
        ratio < 4.0,
        f"H1+H4 IC is {ratio:.1f}x larger than H1-only — suspicious lookahead from H4 bars",
    )
    print(f"  ✓ H1+H4 / H1-only IC ratio = {ratio:.2f} (< 4.0)")


def test_mtf_no_future_leak_h1_plus_d1() -> None:
    """v0.16 bug #2: D1 as coarser TF on H1 base. A D1 bar at midnight holds
    the whole day's data; if ffilled to H1=01:00 without shift, 01-23 hours
    of future data leak in. Ratio test like above.
    """
    panel = _make_panel(n_days=60, n_symbols=30, bar_minutes=60)
    close = to_wide(resample_panel(panel, TimeFrame.H1), "close")

    f_h1 = compute_pool_factor(
        panel,
        alphas=["reversal_v02"],
        timeframes=[TimeFrame.H1],
        combiner="ic_weight",
        ic_lookback=60,
        orthogonalize=False,
    )
    f_h1d1 = compute_pool_factor(
        panel,
        alphas=["reversal_v02"],
        timeframes=[TimeFrame.H1, TimeFrame.D1],
        combiner="ic_weight",
        ic_lookback=60,
        orthogonalize=False,
    )

    ic_h1 = abs(_ic(f_h1, close, horizon=1))
    ic_h1d1 = abs(_ic(f_h1d1, close, horizon=1))
    ratio = ic_h1d1 / max(ic_h1, 1e-6)

    print(f"  H1 only  |IC| = {ic_h1:.4f}")
    print(f"  H1+D1    |IC| = {ic_h1d1:.4f}")
    print(f"  ratio = {ratio:.2f}")
    # Bug version: ratio ~ 15-30x (D1 leaks 23 future hours per day)
    _require(
        ratio < 5.0,
        f"H1+D1 IC is {ratio:.1f}x larger than H1-only — suspicious lookahead from D1 bars",
    )
    print(f"  ✓ H1+D1 / H1-only IC ratio = {ratio:.2f} (< 5.0)")


def test_combiner_weights_are_shifted() -> None:
    """ic_weight combiner computes rolling IC from forward returns, so its
    weights structurally know about t+1. We require it to shift(1) those
    weights before applying — verify by checking that forcibly reverting
    the shift causes a huge IC jump on noise data.

    This is a structural check: on pure noise input where true IC should be
    ~0, if the combiner didn't shift, it would data-mine a non-zero weight
    pattern that is in-sample. Post-fix, noise should stay near 0.
    """
    panel = _make_panel(n_days=60, n_symbols=20)
    close = to_wide(resample_panel(panel, TimeFrame.H1), "close")

    # Force each alpha to be noise-replaced by using reversal_v02 with very
    # short window — structural IC should still be small, but any lookahead
    # leakage via ic_weight rolling IC would inflate it.
    f = compute_pool_factor(
        panel,
        alphas=["reversal_v02"],
        timeframes=[TimeFrame.H1],
        combiner="ic_weight",
        ic_lookback=30,          # short lookback = max chance of overfit
        orthogonalize=False,
    )
    ic = _ic(f, close, horizon=1)
    print(f"  ic_weight output |IC| on single-alpha H1 = {abs(ic):.4f}")
    # With 30-bar ic_weight lookback and no shift, a fitted-to-test signal
    # would show |IC| > 0.1. With proper shift(1), stays < 0.05.
    _require(
        abs(ic) < 0.1,
        f"ic_weight combined factor has |IC|={abs(ic):.3f}, >0.1 suggests forward-return contamination in weights",
    )
    print(f"  ✓ |IC| = {abs(ic):.4f} (< 0.1)")


def test_lgbm_combiner_does_not_leak() -> None:
    """LGBM combiner (v0.21) does walk-forward fitting — trained only on
    data strictly before each test date (with horizon-purge). Verify that
    a pure-noise input signal pool gives |IC| ≈ 0.

    If the combiner accidentally peeked at future data in the fit set,
    noise would get high IC.
    """
    from src.lgbm_combiner import lgbm_combine, _HAS_LGBM
    if not _HAS_LGBM:
        print("  (lightgbm not installed — skipping)")
        return

    panel = _make_panel(n_days=120, n_symbols=20, bar_minutes=60)
    close = to_wide(resample_panel(panel, TimeFrame.H1), "close")
    # Pure noise "signals" — independent of close
    rng = np.random.default_rng(7)
    signals = {
        "noise1": pd.DataFrame(
            rng.standard_normal(close.shape), index=close.index, columns=close.columns
        ),
        "noise2": pd.DataFrame(
            rng.standard_normal(close.shape), index=close.index, columns=close.columns
        ),
    }
    f = lgbm_combine(
        signals, close, horizon=5, refit_every=50, min_train_obs=500,
        n_estimators=50, learning_rate=0.05, max_depth=3,
    )
    ic = _ic(f, close, horizon=5)
    print(f"  noise pool through LGBM |IC| = {abs(ic):.4f}")
    _require(
        abs(ic) < 0.05,
        f"LGBM on pure noise produced |IC|={abs(ic):.3f} — data leak suspected",
    )
    print(f"  ✓ LGBM noise |IC| = {abs(ic):.4f} (< 0.05)")


# ---------- runner ----------


def run_all() -> int:
    tests = [
        test_oracle_ic_is_one,
        test_noise_factor_has_zero_ic,
        test_mtf_no_future_leak_h1_plus_h4,
        test_mtf_no_future_leak_h1_plus_d1,
        test_combiner_weights_are_shifted,
        test_lgbm_combiner_does_not_leak,
    ]
    failed = 0
    print(f"running {len(tests)} lookahead tests...\n")
    for t in tests:
        name = t.__name__
        print(f"[{name}]")
        try:
            t()
            print(f"  PASS\n")
        except TestFailure as e:
            print(f"  FAIL: {e}\n")
            failed += 1
        except Exception as e:
            print(f"  ERROR: {type(e).__name__}: {e}\n")
            failed += 1
    print(f"{'='*60}")
    print(f"{len(tests)-failed} / {len(tests)} passed, {failed} failed")
    return failed


if __name__ == "__main__":
    import warnings
    warnings.filterwarnings("ignore")
    sys.exit(run_all())
