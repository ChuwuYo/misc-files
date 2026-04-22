# HANDOFF — quant-factor 项目接力文档

**日期**: 2026-04-21
**当前状态**: v0.25 跨市场基准对比完成，下一步 v1.0 = per-market config 框架
**本文给下一个 session 的 Claude 用**

## 最新已 commit 状态

- HEAD: `3dc385e` "quant-factor 归档：v0.24 最终冠军 + 6 个里程碑版本独立存档"
- 之后有 v0.25 archive README 改动**未 commit**（文件 [archive/v0.25_cross_market_analysis/README.md](archive/v0.25_cross_market_analysis/README.md)）

## 项目最高 OOS 数字（Binance 45 + funding，walk-forward 5-fold @ h=20）

| config | mean Sharpe | min | win% |
|---|---:|---:|---:|
| **v0.24 winner（85/15 ic+LGBM, 400/120 fold）** | **+3.95** | **+0.38** | **100%** |
| v0.18 ic_weight + funding | +3.37 | +1.39 | 100% |

## v0.25 跨市场对比的核心发现

**单一配置不通吃**。每市场最优不同：

| 市场 | universe | 最佳 config | mean Sharpe | win% |
|---|---|---|---:|---:|
| SP50 US | 51 sym, 3y | LGBM 100% | +3.42 | 100% (only 2 folds) |
| **Binance** | 45 sym + funding | **85/15 ensemble** | **+3.95** | **100% (5 folds)** |
| HL 15 majors | + funding | LGBM 100% | +4.48 | 80% |
| **HL 37 expanded** | + funding | **LGBM 100%** 🔥 | **+9.18** | 80% |

**反直觉**：HL 37 expanded（之前 ic_weight 给 -0.42 被判失败）在 LGBM 100% 下 **mean +9.18** — 噪声币包含 LGBM 能挑的非线性 alpha。

## v1.0 下一步任务（per-market config 框架）

### 目标
建 `src/market_configs.py`，定义 `MarketConfig` dataclass + 每市场一个 entry。
脚本 `python -m run --market binance_perp` 自动用对的 config 跑。

### 模板（写在 v0.25 README 末尾）

```python
@dataclass
class MarketConfig:
    name: str
    universe_fn: Callable[[], pd.DataFrame]
    ppy: int                  # 252 equity, 365 crypto
    horizon: int              # 10 equity, 20 crypto
    ic_lookback: int          # 90 equity, 180 crypto
    smooth_lambda: float      # 0.7 equity, 0.0 crypto
    combiner: str             # 'ic_weight' / 'lgbm' / 'ensemble'
    weight_lgbm: float        # ensemble only
    fold_min_train: int       # 200 short data, 400 crypto
    fold_test_size: int

MARKET_CONFIGS = {
    'sp50_us': MarketConfig(... combiner='lgbm', weight_lgbm=1.0 ...),
    'binance_perp': MarketConfig(... combiner='ensemble', weight_lgbm=0.15 ...),
    'hl_majors': MarketConfig(... combiner='lgbm', weight_lgbm=1.0 ...),
    'hl_expanded': MarketConfig(... combiner='lgbm', weight_lgbm=1.0 ...),
}
```

### 顺序
1. 建 `src/market_configs.py` + `MarketConfig` dataclass
2. 重构 `archive/v0.24_ensemble_400_120/config.py` 用 MarketConfig
3. 跑 `for cfg in MARKET_CONFIGS: run(cfg)` 验证 4 市场 walk-forward 全过预期
4. 把 4 市场 result 表存到 `archive/v1.0_per_market_framework/README.md`

### 后续可选（v1.1+）
- Inner-CV auto-tune `weight_lgbm` per market
- 添加 `auto_universe_filter()` 自动按 dollar volume 选 top-N
- 加更多市场（A 股 akshare、欧股、商品期货）

## 关键文件位置

| 文件 | 用途 |
|---|---|
| `src/factor.py` | `compute_pool_factor`, `compute_mtf_factor` 主入口 |
| `src/lgbm_combiner.py` | LightGBM combiner（rank_target/rank_features 关键参数）|
| `src/alphas.py` | 19 核心 alpha + 14 Alpha158 rolling（已验证无效）|
| `src/timeframes.py` | TimeFrame, LEFT_LABELED_TFS, resample_panel |
| `src/data_crypto.py` | Binance public API（candles + funding）|
| `src/data_hl.py` | Hyperliquid public API（candles + funding）|
| `src/data_real.py` | yfinance（SP50 US equity）|
| `backtest/portfolio.py` | factor_to_pnl, sharpe, ensemble_pnl |
| `backtest/walk_forward.py` | walk_forward_evaluate（IC-based）|
| `backtest/evaluate.py` | IC / Spearman / decay / half-life |
| `tests/test_lookahead.py` | 6 个 lookahead 防御测试 |
| `archive/` | 6 个里程碑版本归档（README + config.py）|
| `iterations/v0.1.md` ~ `v0.24.md` | 24 轮迭代复盘 |

## 已探索失败的方向（不要再试）

- **Alpha101 子集**（v0.5）：合成上看似强，真数据无信号
- **Alpha158 rolling 扩展 14 features**（v0.24）：和现有 alpha 冗余，33 alphas 反而 mean -1.16
- **HL universe 扩张**（v0.22）：从 15 主流扩到 37 含新币 ic_weight 给 -0.42（但 LGBM 100% 给 +9.18 — 留给 v1.0 验证）
- **跨市场 ensemble**（v0.19）：相关性 ≈ 0 但 Sharpe lift 失败
- **LGBM rank_features=True**（v0.21-v0.22）：压扁 magnitude，必须 raw_features
- **Multi-horizon ensemble**（v0.22）：horizon 间相关 0.4-0.85 太高，diversification 失败
- **PCA k=3**（v0.9）：v0.11 walk-forward 翻案 fold 0 t=-3
- **Sharpe-weighted adaptive ensemble**（v0.19/v0.22）：跟风错信号
- **Stump LGBM (max_depth=1)**（v0.22）：mean +0.32 远不及 max_depth=2

## 当前 working tree 状态

```
modified:   ROADMAP.md  (v0.24 entry 已写)
modified:   src/alphas.py  (Alpha158 rolling 已加，标注无效)
new:        archive/v0.25_cross_market_analysis/README.md  (跨市场表)
new:        iterations/v0.22.md, v0.23.md, v0.24.md
modified:   src/lgbm_combiner.py, src/timeframes.py, src/factor.py
modified:   tests/test_lookahead.py  (加第 6 个 LGBM 测试)
new:        backtest/portfolio.py
data_cache/  (gitignored — 含 Binance/HL/SP50 parquet 缓存)
```

## 用户偏好（已存 memory）

- caveman 模式（短句无废话）
- 撤销"不做 ML 黑箱"约束 — LightGBM 可用
- 不需要可解释性
- 测试要严：walk-forward + 100% win 是金标准
- 出错先诊断不躺平
- 数据源优先 Hyperliquid > Binance > yfinance

## v1.0 启动 prompt 建议

> 读 `quant-factor/HANDOFF.md`。当前在 v0.25 后，准备建 v1.0 = per-market config 框架。
> 按 HANDOFF "v1.0 下一步任务" 顺序执行：先建 `src/market_configs.py`，
> 跑 4 市场验证，结果归档到 `archive/v1.0_per_market_framework/`。
