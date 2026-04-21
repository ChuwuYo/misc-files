# 参考血统

## 学术经典

- **Jegadeesh (1990)** "Evidence of Predictable Behavior of Security Returns" — 短期反转。
- **Jegadeesh & Titman (1993)** — 中期动量（反转的镜像）。
- **Fama-French (1993, 2015)** — 三因子/五因子，规模/价值/盈利/投资。
- **Carhart (1997)** — 动量四因子。
- **Asness, Frazzini, Pedersen (2013) "QMJ"** — Quality minus Junk。

## 开源工程

- **WorldQuant Alpha101** (Kakushadze 2015 "101 Formulaic Alphas") — 101 个公式因子，rank/correlation/ts_argmax 等算子。
- **Microsoft Qlib Alpha158/Alpha360** — 量价衍生特征工厂，KMID/KLEN/ROC/STD 系列。
- **JoinQuant / 米筐** 公开因子库 — A 股本地化版本，行业中性化经验。
- **Zipline / Quantopian Pipeline** — 因子组合 API 设计。
- **alphalens** — IC/IR/Quantile 分析框架，回测层抄它。
- **Barra (MSCI) USE3/CNE5** 风险模型 — 风险因子残差化思路。

## 设计原则吸收

| 来源 | 吸收的点 |
|---|---|
| Alpha101 | 算子组合表达力强；保留 `rank/scale/ts_*` 模式 |
| Qlib | 量价特征工厂的命名规范；KBAR 系列衍生 |
| Barra | 中性化思路：先剥离风格暴露再看残差信号 |
| QMJ | 质量维度可作为长期增强 |
| Alphalens | 回测指标定义（IC/Rank IC/IR/Turnover）作为标准 |

## 待研究

- DeepAlpha / MASTER / HIST 等图神经网络因子（v0.x 暂不引入，先打牢线性）
- Bryan Kelly 的 IPCA 思路（条件因子）
- 加密因子：funding rate、basis、open interest 衍生
