# 迭代路线图

每轮聚焦一个「短板」。不堆功能——先优化质量再加复杂度。

## 已完成

- [x] **v0.1** 骨架 + 短期反转 baseline + 截面 rank 标准化 + 合成数据回测
- [x] **v0.2** 模块化 Pipeline + 特质波动率阻尼（AHXZ 2006 / FP BAB 思想）—— IR +17%
- [x] **v0.3** Multi-Timeframe（1m-1M 全 TF）+ ic_weight signed combiner + 开源参考克隆
       —— 单 TF 0.028 → MTF 0.156 OOS（5x），换手 22% → 5%
- [x] **v0.4** Spearman IC + 半衰期 + IC 自相关 + 多 horizon 评估器
       —— intraday 信号峰值 h=3，半衰期 4.3h，IC autocorr ~0 = 纯 alpha
- [x] **v0.5** Alpha101 子集（#1/#4/#6/#12）+ 信号池架构 + Qian-Hua 稀疏化
       —— alphas 在合成数据上接近噪声但池+稀疏化框架已就位，等真数据验真值
- [x] **v0.6** Qlib KBAR 9 + 量价 corr20/cord20 + rsv20，共 12 alphas
       —— IC 0.150 → 0.386（**2.5x**），IR 17.9 → 25.6，IS=OOS 完全无过拟合，跨 4 seed 极稳
- [x] **v0.7** yfinance 真数据接入（SP50 美股 3 年日线）
       —— 现实暴击：合成调参不转移；klen+alpha001 是仅有真信号 t≈2；ic_weight 在真数据过参数化
- [x] **v0.8** Gram-Schmidt 正交化 + warmup t-stat 预筛
       —— OOS h=10 IC 从 -0.012 翻到 +0.019 (t=+1.87)，IS-OOS gap 显著缩小
- [x] **v0.9** PCA k=3 去噪 + EWMA λ 平滑（Marchenko-Pastur RMT）
       —— **OOS h=10 IC=+0.036 t=+3.18 真显著**，ewma0.7 把 TO 从 30% 降到 12%
- [x] **v0.10** 性能向量化（ts_rank/ts_argmax stride_tricks + Gram-Schmidt numpy）
       —— **端到端 2.14s → 0.48s（4.4x）**，IC 不变；ts_rank 单独提速 ~2000x
- [x] **v0.11** Walk-forward 5 折滚动 CV（López de Prado 方法论）
       —— **翻案**：pca3 fold 0 暴负 t=-3，真赢家 ortho+ewma λ=0.7 + lookback=90，
       mean IC +0.044，agg_t +3.64，h=10/h=20 全 100% win rate
- [x] **v0.12** Sector / Size 中性化（Asness 灵魂拷问）
       —— **诚实暴击**：67% IC 来自 sector exposure，纯 alpha 仅 +0.012 t=+1.08；
       因子实质是 "sector rotation + 小 alpha" 而非 stock-picking
- [x] **v0.13** Within-sector pre-rank（**失败 + SP50 universe 天花板**）
       —— std 暴增 3x，agg_t 反降，纯 alpha -43%；触发 universe 扩展决策
- [x] **v0.14** Crypto 接入（Binance 公共 API）+ per-market 调参
       —— 49 主流币 3y daily，per-market 最优 lookback=180/ewma=0；
       h=3 agg_t +3.26 (100% win)、h=30 agg_t +2.69 (100% win)；框架完全泛化
- [x] **v0.15** Crypto sector 分类（手工 8 类）+ 中性化（**诊断，无改进**）
       —— Crypto 损 55% IC vs SP50 损 67%；同结构性问题；纯 alpha 仅 +0.027 (t≈1.2)；
       结论：纯 OHLCV 信号无法逃 sector exposure，需 intraday 或新数据源
- [x] **v0.16** Intraday H1 crypto MTF + **两次修 MTF lookahead bug**
       —— 发现 pandas resample 默认 left-label 在 H4/D1 均致 ffill 泄漏未来；
       修后 intraday IC 缩水 9x（+0.18 → +0.02），**证伪"intraday 比 daily 更强"**；
       SP50/crypto daily 结论不受影响（W1 右标签默认安全）
- [x] **v0.17** Lookahead 自动测试套件（防 v0.16 bug 复发）
       —— 5 零依赖测试，revert fix 时精准抓到 ratio=29.1x (H4) / 15.9x (D1)；
       首次拥有自动化 lookahead 护栏，可 CI / pre-commit
- [x] **v0.18** Crypto 永续 funding rate alpha（**真增量改进**）
       —— Binance public API 拉 45 币 funding；非 OHLCV 维度，与现有 alpha 几乎正交；
       walk-forward h=20 mean IC +0.038 → **+0.055**, agg_t **+2.37 → +3.59** (+52%)；
       crypto 因子首次追上 SP50 水平
- [x] **v0.19** 跨市场 ensemble（OI history 太短转向，**ensemble 假设 OOS 失败**）
       —— 跨市场 PnL 相关 ≈ 0 ✓；但 50/50 ensemble walk-forward Sharpe +1.87 <
       SP-only +2.63。引入 portfolio.py（Sharpe/DD 评估基础设施）+ 揭示 IC vs Sharpe 双指标互补
- [x] **v0.20 + v0.21** Hyperliquid 数据 + LightGBM combiner（**基建胜，OOS 打平**）
       —— HL adapter（229 perps + 3y candles + hourly funding）+ LGBM combiner + lookahead 测试 #6
       都 ship。但 WF h=20 Sharpe：ic_weight +2.24 100% win 仍胜；LGBM +0.63 （fold 1 过拟合崩盘 -10.95）；
       HL 15 sym +2.13 ≈ Binance 45。universe 太小 / fold 间 regime shift 抑制 ML 优势
- [x] **v0.22** LGBM 深度探索（7 正则 config + 快 refit + ensemble + HL 扩 37）—— **全部失败**
       —— fold 1 崩盘是架构性（committed prediction vs rolling avg），不是参数问题；
       HL 扩 universe 从 +2.13 降到 **-0.42**（meme/新币加噪音不加信号）；
       **v0.18 Binance 45 + funding ic_weight 是已探底 OOS 冠军**

## 项目真天花板 — 建议冻结到 v1.0

**生产推荐**：Binance 45 + funding + ic_weight, lookback=180, orthogonalize, horizon=20
- walk-forward 5-fold: mean IC +0.055, **Sharpe +2.24, 100% win, min +0.73**
- 已验证：ML / ensemble / 扩 universe 三方向都无法突破
- [ ] **v0.6** 量价背离信号（Qlib KMID/KLEN 类）作为残差增强
- [ ] **v0.7** 真数据接入（akshare / yfinance），验证分布稳定性
- [ ] **v0.8** 行业/市值中性化（Barra 风格残差），消除已知风险暴露
- [ ] **v0.9** 滚动窗口 PCA 去噪，提升 IC_IR
- [ ] **v0.10** Numba/Polars 加速尝试，对比 pandas 基线
- [ ] **v1.0** 文档完善 + 因子卡片 + 公开示例

每个 vX.Y 必须满足：
1. 回测脚本能跑通，输出 IC、IR、Top-Bottom 收益、年化换手率
2. 相比上一版至少一个核心指标提升（或证明等价但更鲁棒）
3. `iterations/vX.Y.md` 写明：动机、改动、对比、副作用、下一步候选

## 不做

- 不做 ML 黑箱（保持可解释、可审计）
- 不绑定特定数据源 / broker
- 不做盘中信号（日频为主，保持通用性）
