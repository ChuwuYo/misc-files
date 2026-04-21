# v0.16 — MTF Lookahead Bug 修复（关键里程碑）

**状态**: 工程里程碑（不是新配置，是修历史 bug）
**影响**: 所有 intraday MTF (v0.3-v0.15) 的合成数据 IC 数字都被 lookahead 膨胀
**全历史复盘**: [iterations/v0.16.md](../../iterations/v0.16.md)

## Bug 本身

pandas `resample()` 对 intraday 和 daily TFs 默认 `closed='left', label='left'`：
- H4 bar 在 `00:00` 标签 → 其 OHLCV 聚合 **00:00-03:59** 数据
- D1 bar 在 `Monday 00:00` → Monday 全天 00:00-23:59 数据

当 ffill 到更细 TF 网格：
- H1=01:00 拉到 H4=00:00 → 用了 02:00-03:59 未来
- H1=Mon 01:00 拉到 D1=Monday → 用了 Monday 02:00-23:59 未来（23h 未来泄漏！）

## 修法

`src/timeframes.py` 定义 `LEFT_LABELED_TFS = {M1, M5, M15, M30, H1, H4, D1}`。

`src/factor.py` 的 `_align_to_finest` 和 `compute_pool_factor` 对齐阶段：
```python
if tf is not finest and tf in LEFT_LABELED_TFS:
    sig = sig.shift(1)   # delay by 1 bar of own TF
sig.reindex(finest_index).ffill()
```

这样 bar 的 signal 只在**窗口关闭后**才对更细 TF 可见。

**W1 / MO1 不需 shift**（pandas 默认 `closed='right', label='right'`，已是 end-of-window label）。

## 怎么发现的

初次测 H1+H4+D1 MTF 在 crypto 上：IC=+0.33, t=+60 — **数字太夸张**。
手动验证 BTC H4 bar `close == H1[03:00].close` 印证 H4 bar 在 00:00 label 含 03:59 数据。

## 修复前后对比（Crypto H1 MTF, 12m 数据）

| 配置 | fix 前 | fix 后 |
|---|---:|---:|
| H1 only | IC +0.014 | IC +0.014 |
| H1+H4 | IC +0.097（假）| IC +0.009（真）|
| H1+H4+D1 | IC +0.166（假）| IC +0.018（真）|
| H1+H4+D1 @ h=24 | IC +0.327（假）| IC +0.010（真）|

**33x IC 膨胀被纠正**。

## 测试套件（v0.17 接续）

修 bug 后建 `tests/test_lookahead.py`，含 6 个自动测试：
- oracle IC = 1.0（sanity）
- 噪声 IC ≈ 0
- **H1+H4 ratio < 4x** （防此 bug 复发 H4 侧）
- **H1+D1 ratio < 5x** （防 D1 侧）
- ic_weight 权重 shift(1) 验证
- LGBM 非叶 IC ≈ 0（v0.21 后）

## 历史数字影响

| 版本 | 报告 | 修正后（估算）|
|---|---|---|
| v0.3 合成 MTF IC | 0.156 | ~0.05 |
| v0.6 合成 KBAR pool | 0.386 | ~0.10 |
| v0.11 SP50 daily D1+W1 | +0.044 | **不受影响**（W1 right-label 无 lookahead）|
| v0.14 Crypto D1+W1 | +0.039 | **不受影响** |

真数据 daily 结论全 intact。合成 intraday 不可信。

## 代码

没有独立 config.py（是 fix 到 src/ 的全局修改）。查看：
- [`src/timeframes.py`](../../src/timeframes.py) — `LEFT_LABELED_TFS` 定义
- [`src/factor.py`](../../src/factor.py) — `_align_to_finest` shift 逻辑
- [`tests/test_lookahead.py`](../../tests/test_lookahead.py) — 自动防御
