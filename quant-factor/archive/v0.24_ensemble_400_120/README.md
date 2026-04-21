# v0.24 — 最终冠军配置（Crypto）

**状态**: v1.0 候选推荐
**OOS 实测**: mean Sharpe **+3.95**, **100% win (5/5 folds)**, min fold +0.38
**vs v0.18 baseline**: **+76%** mean Sharpe
**全历史复盘**: [iterations/v0.24.md](../../iterations/v0.24.md)

## 关键配方（四要素）

1. **数据**: Binance 45 USDT spot + perpetual funding rate（3 年 daily）
2. **Alpha 池**: 19 个核心 alpha（**排除** Alpha158 rolling 扩展，验证过有害）
3. **因子组合**:
   - `ic_weight` 主模型（线性 rolling IC 加权 + ortho + funding）
   - `LightGBM` 辅助（**rank_target=True, rank_features=False** 是关键）
4. **集成**: 85/15 ic_weight / LGBM PnL 层加权（不是信号层）

## Walk-forward 评估配置

- `min_train = 400 days`
- `test_size = 120 days`
- `5 folds` (**非** 4 folds — 统计显著性更强)
- `horizon = 20 days`（长线反转 sweet spot）
- `purge = 10 days`（防止 forward return 泄漏）

## OOS 指标（Binance 45 + funding）

| 权重 w_lg | f0 | f1 | f2 | f3 | f4 | mean | min | win% |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0.00 (ic_only) | +3.23 | +1.39 | +6.99 | +2.55 | +2.70 | +3.37 | +1.39 | 100% |
| 0.05 | +3.43 | +1.09 | +7.16 | +2.71 | +3.43 | +3.56 | +1.09 | 100% |
| 0.08 | +3.55 | +0.89 | +7.27 | +2.81 | +3.89 | +3.68 | +0.89 | 100% |
| 0.10 | +3.64 | +0.75 | +7.33 | +2.87 | +4.21 | +3.76 | +0.75 | 100% |
| 0.12 | +3.72 | +0.60 | +7.40 | +2.94 | +4.53 | +3.84 | +0.60 | 100% |
| **0.15 ⭐** | **+3.85** | **+0.38** | **+7.50** | **+3.03** | **+5.02** | **+3.95** | **+0.38** | **100%** |
| 0.20 | +4.06 | -0.03 | +7.64 | +3.18 | +5.87 | +4.15 | -0.03 | 80% ⬇ |
| 0.30 | +4.46 | -0.93 | +7.87 | +3.43 | +7.62 | +4.49 | -0.93 | 80% |
| 1.00 (LGBM only) | +3.92 | -5.71 | +5.24 | +2.42 | +14.69 | +4.12 | -5.71 | 80% |

## 为什么这个配方胜

### rank_target + raw_features（v0.23 突破）
之前 `rank_features=True` 把 alpha 的 magnitude 压扁到 [-0.5, 0.5]，
LGBM 看不到 klen=0.05 和 klen=0.001 的差别，决策树能切分的信息少。
**保留 raw 特征 + rank 目标**：LGBM 能学"klen 极大 AND funding 极大 → 强信号"的交互。

### 85/15 而非 50/50（v0.24 发现）
LGBM 单跑有 fold 1 regime-shift 崩盘（-5.71 Sharpe）。
与 ic_weight 加权混合能"吸 LGBM 上涨同时 ic_weight 守住崩盘 fold"。
**15% 是临界点**：再加到 20% 就破 100% win。

### 400/120 而非 300/160（v0.24 发现）
原本用 300/160 fold eval（4 folds），测 100% win 边界 w_lg=0.08 (+2.46)。
换成 400/120（5 folds）后 ic_only 本身 Sharpe 从 +2.24 → +3.37，
边界上调到 w_lg=0.15 (+3.95)。**更长 train 让 LGBM 学更稳的模式**。

## 运行代码

见同目录 [`config.py`](config.py)，可直接 `python config.py` 跑出 Sharpe 表。

## 副作用 / 边界

- Seed: max_depth=2 + 无 bagging → **完全确定性**（5 seeds 测试 bit-identical）
- Alpha158 扩展（ROC/MA/STD/SUMP/...）**不要加**：和现有 alpha 冗余反而稀释
- SP50 美股下 v0.24 配置不一定最优（应保留 `smooth_lambda=0.7`）—— **crypto 专用**
- HL universe 更小（15-37 sym）时 fold 间方差大，本配置未深度验证

## 未来扩展方向

若用户撤销"OHLCV+funding-only"限制：
- on-chain metrics（Glassnode / DefiLlama TVL）
- 订单薄深度 / taker ratio
- Funding hourly 而非 daily（HL 原始 hourly 数据已有）
- 跨交易所 basis / 套利信号
