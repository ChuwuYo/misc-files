# v0.25 — 跨市场基准对比（4 markets × 5 weight configs）

**状态**: 诊断里程碑 — 揭示"单一配置不通吃"的事实
**输入**: v0.24 配方（rank_target + raw_features LGBM, 400/120 fold eval）
**测试范围**: 4 市场 × 5 LGBM 权重 = 20 walk-forward runs

## 核心发现

**没有任何单一配置在所有市场都是最优的**。

| 市场 | universe | 100%-win 最佳 | 最高 mean | best 配置 |
|---|---|---:|---:|---|
| **SP50 US** (51 sym, ppy=252) | 51 美股 | LGBM 100% (+3.42) | LGBM 100% (+3.42) | LGBM 100% ✓ |
| **Binance** (45 + funding, ppy=365) | 45 主流币 + funding | 85/15 ensemble (+3.95) | LGBM 100% (+4.12, 80%) | **85/15 ensemble** ⭐ |
| **HL 15 majors** (+ funding) | 15 主流币 | 无 100% win | LGBM 100% (+4.48, 80%) | LGBM 100% |
| **HL 37 expanded** (+ funding) | 37 含新币 | 无 100% win | **LGBM 100% (+9.18, 80%)** 🔥 | LGBM 100% |

## 完整结果表

```
=== SP50 US equity (51 sym, 3y daily, ppy=252) — 2 folds ===
weight       f0      f1     mean   min   win%
lg=0.00    -0.64   -1.71   -1.18  -1.71    0%
lg=0.08    -0.58   -1.12   -0.85  -1.12    0%
lg=0.15    -0.52   -0.51   -0.52  -0.52    0%
lg=0.20    -0.47   -0.01   -0.24  -0.47    0%
lg=1.00    +0.37   +6.47   +3.42  +0.37  100%

=== Binance 45 + funding (ppy=365) — 5 folds ===
weight     f0    f1    f2    f3    f4     mean   min   win%
lg=0.00  +3.23 +1.39 +6.99 +2.55 +2.70   +3.37  +1.39  100%
lg=0.08  +3.55 +0.89 +7.27 +2.81 +3.89   +3.68  +0.89  100%
lg=0.15  +3.85 +0.38 +7.50 +3.03 +5.02   +3.95  +0.38  100%  ⭐
lg=0.20  +4.06 -0.03 +7.64 +3.18 +5.87   +4.15  -0.03   80%
lg=1.00  +3.92 -5.71 +5.24 +2.42 +14.69  +4.12  -5.71   80%

=== HL 15 majors + funding (ppy=365) — 5 folds ===
weight      f0      f1    f2     f3     f4     mean   min   win%
lg=0.00   -2.48   +0.69 +3.33 -0.10  +5.15   +1.32  -2.48   60%
lg=0.08   -2.15   +0.73 +3.79 -0.15  +5.99   +1.64  -2.15   60%
lg=0.15   -1.81   +0.76 +4.22 -0.21  +6.73   +1.94  -1.81   60%
lg=0.20   -1.52   +0.78 +4.54 -0.25  +7.24   +2.16  -1.52   60%
lg=1.00   +3.58   +0.63 +8.44 -0.75  +10.48  +4.48  -0.75   80%

=== HL 37 expanded + funding (ppy=365) — 5 folds ===
weight      f0      f1     f2     f3      f4    mean   min   win%
lg=0.00   +9.60   -5.12  -0.30  +0.25   +2.42  +1.37  -5.12   60%
lg=0.08  +10.59   -5.13  -0.08  +1.51   +4.34  +2.25  -5.13   60%
lg=0.15  +11.46   -5.11  +0.15  +2.75   +6.09  +3.07  -5.11   80%
lg=0.20  +12.07   -5.09  +0.33  +3.70   +7.34  +3.67  -5.09   80%
lg=1.00  +14.86   -2.73  +3.16  +13.53  +17.10 +9.18  -2.73   80%  🔥
```

## 重大反直觉

### LGBM 100% 在 3/4 市场 mean 最高
SP50（+3.42）、HL 15（+4.48）、HL 37（+9.18）—— 都是 LGBM 单跑赢。
只有 Binance（85/15 +3.95 win 100% > LGBM 100% +4.12 win 80%）适合 ensemble。

### HL 37 expanded LGBM 揭示之前误判
v0.22 报告 HL 37 ic_weight = -0.42（崩），结论"扩 universe 不行"。
**实际**：LGBM 100% 在同一 universe 给 +9.18 Sharpe — 噪声币包含 LGBM 能挑出的非线性 alpha。

### SP50 ic_only -1.18（亏！）
原因：用了 crypto-tuned 配置（lookback=180, smooth=0）—— SP50 需要 v0.11 的 lookback=90, smooth=0.7。
**单一配置确实不通吃**。LGBM 100% 在 SP50 反而不需要市场特定调参。

## 为 v1.0 通用化的启示

1. **Per-market config 框架是必需的** — 不能硬编码一套参数走遍所有市场
2. **LGBM 100% 是更通用的默认** — 在 80% 的市场是 mean 最高，且不需 market-specific 调参
3. **Binance ensemble 是 special case** — 因 ic_weight 在 Binance 太稳，叠加才能更稳
4. **小 universe（HL 15）需 LGBM** — ic_weight rolling IC 在 15 sym 上方差太大
5. **Universe 噪声 ≠ universe 无信号** — HL 37 LGBM 能挑出 ic_weight 看不到的 pattern

## 下一版（v1.0）方向

建 `src/market_configs.py`：

```python
@dataclass
class MarketConfig:
    name: str
    universe_fn: Callable[[], pd.DataFrame]
    ppy: int
    horizon: int
    ic_lookback: int
    smooth_lambda: float
    combiner: Literal['ic_weight', 'lgbm', 'ensemble']
    weight_lgbm: float  # only used if combiner == 'ensemble'
    fold_min_train: int
    fold_test_size: int

MARKET_CONFIGS = {
    'sp50_us': MarketConfig(name='sp50_us', universe_fn=fetch_sp50,
                             ppy=252, horizon=10, ic_lookback=90, smooth_lambda=0.7,
                             combiner='lgbm', weight_lgbm=1.0,
                             fold_min_train=200, fold_test_size=110),
    'binance_perp': MarketConfig(name='binance_perp', universe_fn=fetch_binance_w_funding,
                                  ppy=365, horizon=20, ic_lookback=180, smooth_lambda=0.0,
                                  combiner='ensemble', weight_lgbm=0.15,
                                  fold_min_train=400, fold_test_size=120),
    'hl_majors': MarketConfig(...),
    'hl_expanded': MarketConfig(...),
}

def run_market(name):
    cfg = MARKET_CONFIGS[name]
    panel = cfg.universe_fn()
    factor = build_factor_from_config(panel, cfg)
    return walk_forward_eval(factor, panel, cfg)
```

## 代码

无独立 config.py（这是诊断归档，不是新模型）。运行复现：

```bash
python archive/v0.25_cross_market_analysis/cross_market_eval.py
```
