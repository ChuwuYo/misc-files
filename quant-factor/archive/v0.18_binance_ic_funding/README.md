# v0.18 — Crypto ic_weight 基线冠军（before LGBM）

**状态**: 保守版推荐（纯线性，无 ML 依赖）
**OOS 实测**: mean Sharpe +2.24 (300/160) / **+3.37 (400/120)**, 100% win
**vs v0.14 Binance OHLCV-only**: +52% agg_t（funding alpha 贡献）
**全历史复盘**: [iterations/v0.18.md](../../iterations/v0.18.md)

## 这个版本的里程碑意义

**首次把永续 funding rate 作为非 OHLCV alpha 加入 pool，验证是真增量信号**。

- Binance `/fapi/v1/fundingRate` 公共 API 无需 auth
- 45 币 3 年 hourly funding → daily 平均
- 2 个 funding alpha: `funding_reversal` (cross-sectional rank) + `funding_zscore` (30d rolling z)
- funding 与现有 alpha 几乎正交（IC 不冗余）

## OOS 指标（walk-forward 5 折 @ h=20）

| fold config | mean IC | mean Sharpe | win% |
|---|---:|---:|---:|
| 300/160 (4 folds) | +0.055 | +2.24 | 100% |
| **400/120 (5 folds)** | **+0.073** | **+3.37** | **100%** |

## 核心配方

```python
compute_pool_factor(
    panel,                              # Binance 45 + funding 合并 panel
    alphas=ALPHA_GROUPS['all'] except alpha158_rolling,  # 19 alphas
    timeframes=[TimeFrame.D1, TimeFrame.W1],
    combiner='ic_weight',
    ic_lookback=180,                    # crypto-tuned（equity 是 90）
    min_abs_ic=0.01,                    # Qian-Hua 稀疏化阈值
    orthogonalize=True,                 # Gram-Schmidt 去冗余
    smooth_lambda=0.0,                  # crypto 不要 EWMA（equity 是 0.7）
)
```

## funding alpha 独立贡献（之前的诊断）

加 `funding_reversal + funding_zscore` 后，walk-forward Sharpe 从 v0.14 的
+2.37 IR（17 alpha）提升到 +3.59 IR（19 alpha），**+52% agg_t**。

funding_reversal 单独跑 h=20 IC=+0.045, t=+9.85（独立超强）。

## 何时用这个 vs v0.24

- **用 v0.18**: 不想装 LightGBM 依赖、要纯线性可审计、要 max_depth=0 简单路径
- **用 v0.24**: 要最高 OOS Sharpe（+3.95 vs +3.37，+17%）、能装 ML 依赖

## 代码

见 [`config.py`](config.py)。
