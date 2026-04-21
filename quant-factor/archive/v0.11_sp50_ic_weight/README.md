# v0.11 — US 美股 SP50 冠军（walk-forward 里程碑）

**状态**: US 美股推荐配置
**OOS 实测**: mean IC +0.044, **agg_t +3.64, 100% win 5 folds** (h=10, 300/160 eval)
**mean Sharpe** (v0.19 reported): +2.63, 100% win
**全历史复盘**: [iterations/v0.11.md](../../iterations/v0.11.md)

## 里程碑意义

1. **首次引入 walk-forward CV**（López de Prado 方法论）
2. **翻案 v0.9 pca3 错误结论**（pca3 fold 0 暴负 t=-3 露馅）
3. US 美股首次**跨多 horizon + walk-forward 全通过**

## 核心配方

```python
compute_pool_factor(
    panel,                              # SP50 51 只 × 3y daily (yfinance)
    alphas=ALPHA_GROUPS['all'] except alpha158_rolling,  # 17 alphas (no funding)
    timeframes=[TimeFrame.D1, TimeFrame.W1],
    combiner='ic_weight',
    ic_lookback=90,                     # US equity 短，crypto 是 180
    min_abs_ic=0.01,
    orthogonalize=True,                 # Gram-Schmidt
    smooth_lambda=0.7,                  # EWMA 平滑（US 独有，crypto 用 0.0）
)
```

## OOS 指标（walk-forward 5 fold, h=10）

| 配置 | mean IC | agg_t | 100% win | 备注 |
|---|---:|---:|---|---|
| v0.11 winner | +0.044 | **+3.64** | ✓ | SP50 基线 |
| v0.9 pca3 (错) | +0.036 | +3.18 | — | 50/50 分割的假象 |
| 无 ortho | +0.021 | +2.41 | ✓ | 证 Gram-Schmidt 的价值 |

## 关键超参（与 crypto 对比）

| 维度 | US equity (v0.11) | Crypto (v0.18+) |
|---|---|---|
| ic_lookback | **90** | 180 |
| smooth_lambda | **0.7** | 0.0 |
| best horizon | **h=10** | h=20 |
| 理由 | 日频相对稳定，短 lookback + smooth 好 | 制度切换频繁，长 lookback 不 smooth 更好 |

**结论**：不同市场需独立调参。**不能把 crypto 配置搬到 US equity 上**。

## v0.24 在 US 上是否应用？

v0.24 (LGBM 85/15) 测试于 Binance crypto。在 SP50 上未验证，且：
- LGBM 原 crypto 配置（max_depth=2, lookback=10）可能不适 US
- US 周期性更稳 → ic_weight + smooth 可能已足够

**US 推荐保持 v0.11 ic_weight**。LGBM 扩展留 v0.x 探索。

## 代码

见 [`config.py`](config.py)。
