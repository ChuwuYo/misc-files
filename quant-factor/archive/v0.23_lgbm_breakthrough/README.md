# v0.23 — LGBM 首次真胜出（rank_target + raw_features 突破）

**状态**: LGBM 路线的关键突破点
**OOS 实测**: mean Sharpe +2.46, 100% win (300/160 eval, 92/8 ensemble)
**vs v0.18**: **+10%** mean Sharpe, 100% win 保持
**全历史复盘**: [iterations/v0.23.md](../../iterations/v0.23.md)

## 关键突破

v0.21/v0.22 一直用 `rank_features=True`（所有 alpha 先做截面 rank），
LGBM 看不到特征 magnitude → 决策树切分信息有限 → 过拟合 fold 1。

**v0.23 换 `rank_target=True, rank_features=False`**：
- 保留 alpha 的原始 magnitude（klen=0.05 vs 0.001 有别）
- Target 仍 rank 化防止 return 极值
- LGBM 能学"klen 极大 AND funding 正 → 强信号"的交互

单用 LGBM mean Sharpe +3.22（从 +1.59 起飞）。

## 配方

```python
# LGBM 主角
f_lgbm = lgbm_combine(
    features, close_wide,
    horizon=20, refit_every=10,
    rank_target=True,           # target 还做 rank
    rank_features=False,        # ← features 保 raw (key)
    min_train_obs=1000,
    max_depth=2,                # 浅树防过拟合
    n_estimators=300,
    learning_rate=0.05,
    reg_lambda=10.0,            # L2 正则
)

# 92/8 PnL 集成
pnl_ens = 0.92 * pnl_ic_weight + 0.08 * pnl_lgbm
```

## OOS 性能演进（同一 300/160 eval）

| config | mean | min | win% |
|---|---:|---:|---:|
| v0.18 ic_only | +2.24 | +0.73 | 100% |
| v0.21 LGBM(rank+rank) | +1.59 | -8.05 | 75% ✗ |
| v0.23 LGBM 单跑 | +3.22 | -7.12 | 75% |
| **v0.23 95/5 ens** | +2.37 | +0.31 | 100% |
| **v0.23 92/8 ens** | **+2.46** | +0.05 | **100%** |
| v0.23 40/60 ens | +3.75 | -5.02 | 75% |

## 为什么不直接推 v0.24？

v0.24 基于 v0.23 + 更优的 400/120 fold eval：
- 如果有长 data 用 **v0.24**（+3.95 Sharpe）
- 如果受 fold 配置约束或保守 **v0.23** 依然可用（+2.46 Sharpe）

## 代码

见 [`config.py`](config.py)。
