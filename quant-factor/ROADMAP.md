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

## 计划中
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
