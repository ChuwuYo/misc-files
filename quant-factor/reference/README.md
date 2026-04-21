# 开源参考资料

本目录存放克隆的开源因子项目，**只读参考**——不要在此目录修改代码。
吸收的设计点会被改写进 `../src/` 并在 `../iterations/vX.Y.md` 注明出处。

## 项目清单

### 1. [qlib/](qlib/) — Microsoft Qlib

**地位**：行业最强开源量化平台之一。强项是数据 handler、特征工厂、高频处理。

**重点目录**：
- `qlib/contrib/data/handler.py` — `Alpha158`、`Alpha360` 标准特征集（量价衍生 158/360 个）
- `qlib/contrib/data/highfreq_handler.py` — 高频数据 handler，**多 TF 设计参考**
- `qlib/data/dataset/processor.py` — `DropnaProcessor` / `Fillna` / `RobustZScoreNorm` / `CSRankNorm` 等
- `qlib/data/ops.py` — 算子库（`Ref`, `Mean`, `Std`, `Rsquare`, `Corr`...）—— Alpha101 风格

**我们已吸收**：截面 rank 标准化、winsorize 思想（v0.2）；多 TF handler 思路（v0.3 进行中）

**待吸收**：完整算子表达式 DSL；高频数据处理流程；Dataset 滚动训练接口

### 2. [alphalens-reloaded/](alphalens-reloaded/) — 因子评估事实标准

**地位**：原 alphalens（Quantopian）的活跃 fork，因子收益/IC/Quantile 分析框架。

**重点文件**：
- `src/alphalens/performance.py` — `factor_information_coefficient`, `mean_return_by_quantile`,
  `factor_alpha_beta`, `factor_returns` 函数定义——**评估指标的事实标准**
- `src/alphalens/tears.py` — Tear sheet 报告组织方式
- `src/alphalens/utils.py` — `get_clean_factor_and_forward_returns`——数据预处理范式

**我们已吸收**：IC / Rank IC / Quantile spread / Turnover 指标定义（v0.1）

**待吸收**：IC 衰减曲线、Sector neutral 评估、Top quantile 集中度分析

### 3. [WorldQuant_alpha101_code/](WorldQuant_alpha101_code/) — Alpha101 公式实现

**地位**：Kakushadze (2015) "101 Formulaic Alphas" 的 Python 落地版本之一。

**重点文件**：
- `101 Formulaic Alphas.pdf` — 原论文
- `101Alpha_code_1.py`, `101Alpha_code_2.py` — 101 个 alpha 的逐个实现，含 `rank()`,
  `delta()`, `correlation()`, `ts_argmax()` 等算子

**我们已吸收**：截面 rank + 取负的反转模式（Alpha #4 / #6 风格）

**待吸收 v0.5**：Alpha #1（横截面 rank 取负的累计收益反转）、Alpha #4（low rank 反转）、
Alpha #6（vol 加权 corr）、Alpha #12（vol-adjusted 短期反转）

## 使用约定

- 所有引用必须在 `iterations/vX.Y.md` 写明出处（项目 / 文件 / 行号或函数名）
- 不直接 `import qlib` 等运行时依赖——**只看代码、自己写**，避免被框架绑定
- 若发现某个开源因子表现极佳，先在 `research/<topic>.md` 解释它为什么有效，再决定是否吸收

## 待加（候选）

- pyfolio / quantstats — 业绩归因
- Tushare / akshare — A 股数据源（v0.7 用）
- zipline-reloaded — Pipeline API 设计参考
- vnpy `vnpy_ctastrategy` `BarGenerator` — 多 TF 增量聚合参考代码
