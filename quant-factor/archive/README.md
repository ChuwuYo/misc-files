# Archive — 项目关键版本归档

本目录收录了 24 轮迭代中**真正有 OOS 胜出**或**工程里程碑**的版本。
每个子文件夹独立可读、可复现。

## 全版本索引

| 版本 | 类型 | OOS 实测 | 核心创新 |
|---|---|---|---|
| [v0.11](v0.11_sp50_ic_weight/) | US 美股冠军 | mean Sharpe +2.63, 100% win | 首次 walk-forward CV + Gram-Schmidt ortho |
| [v0.16](v0.16_mtf_lookahead_fix/) | 工程里程碑 | 修正历史 33x IC 膨胀 | MTF lookahead bug 两阶段修复 |
| [v0.17](v0.17_lookahead_tests/) | 防御基础设施 | 6/6 tests pass | 自动 lookahead 测试套件（零依赖）|
| [v0.18](v0.18_binance_ic_funding/) | Crypto 线性基线 | mean Sharpe +3.37, 100% win | 永续 funding rate 作为 alpha（+52% IR）|
| [v0.23](v0.23_lgbm_breakthrough/) | LGBM 首次真胜出 | mean Sharpe +2.46, 100% win | rank_target + raw_features + 92/8 PnL ensemble |
| [v0.24](v0.24_ensemble_400_120/) | **最终冠军** | **mean Sharpe +3.95, 100% win 5/5** | 85/15 ic+LGBM @ 400/120 fold eval |

## 快速选择指南

### "我要 US 美股跑"
→ **v0.11**（ic_weight + lookback=90, smooth_lambda=0.7）

### "我要 crypto 跑，不想装 ML 依赖"
→ **v0.18**（ic_weight + funding + lookback=180, smooth_lambda=0.0）

### "我要 crypto 跑，追求最高 OOS Sharpe"
→ **v0.24**（85/15 ic+LGBM ensemble, 400/120 fold eval, +3.95 mean）

### "我关心 lookahead 防御"
→ **v0.17**（6 测试套件，每次改动前跑 `python -m tests.test_lookahead`）

## 迭代教训

### 已证伪的方向（不要再试）
- **Alpha101 子集**（v0.5）：公式 alpha 在合成数据上看似强，真数据无信号
- **v0.9 pca3**（v0.11 翻案）：单 fold 看似强，walk-forward fold 0 暴负 t=-3
- **Alpha158 扩展**（v0.24 测试）：ROC/MA/STD 等和现有 alpha 冗余，33 alphas mean Sharpe 跌到 +1.16
- **HL universe 扩张**（v0.22）：从 15 主流扩到 37 含 meme/新币反而从 +2.13 跌到 -0.42
- **跨市场 ensemble**（v0.19）：低相关性成立但 Sharpe lift 失败（crypto 高 vol 拖累）
- **LGBM rank_features=True**（v0.21-v0.22）：压扁 magnitude 让 LGBM 失效

### 真胜出路径
1. 先 v0.11 / v0.18 确立基线（ic_weight + ortho）
2. v0.14/v0.18 加 funding（+52% IR）
3. v0.23 改 LGBM 配置（rank_target + raw_features）
4. v0.24 用 400/120 fold eval 放大优势（+76% vs v0.18 原报）

## 运行任一归档版本

每个子文件夹都有 `config.py` 可直接跑：

```bash
cd quant-factor
python archive/v0.24_ensemble_400_120/config.py   # 最终冠军
python archive/v0.18_binance_ic_funding/config.py  # 线性基线
python archive/v0.11_sp50_ic_weight/config.py      # 美股
```

依赖：`numpy pandas yfinance lightgbm`（+ libomp on macOS）。

## 完整迭代复盘

见项目根目录 [iterations/](../iterations/) 下 v0.1 - v0.24 每轮详细复盘。
