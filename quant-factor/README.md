# quant-factor

通用、高性能量化因子。持续迭代，博采众长。

## 目标

- 截面（cross-sectional）单 alpha 因子，输入面板数据 (date × symbol)，输出排名分数 [-1, 1]。
- A 股、美股、加密、期货可复用——不绑定单一市场结构。
- 单核 1M 行 / 1000 票 / 252 日处理 < 2s（向量化 numpy/pandas，不写循环）。
- 模块化：信号 → 中性化 → 衰减 → 组合，可拔插。

## 当前版本

见 `iterations/` 下最新版本号。每轮迭代追加一份 `vX.Y.md` 复盘。

## 参考血统

见 `research/sources.md`。已吸收：WorldQuant Alpha101、Qlib Alpha158/360、Fama-French、Barra 中性化、JT 反转、AQR QMJ。

## 用法

```python
from src.factor import compute_factor
from src.data import sample_panel

panel = sample_panel(n_dates=252, n_symbols=500, seed=42)
score = compute_factor(panel)  # DataFrame (date × symbol) of [-1, 1]
```

## 回测

`backtest/` 内含分组多空 IC/IR/换手率快速评估脚本。每次迭代必跑。
