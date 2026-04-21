# v0.17 — Lookahead 自动测试套件

**状态**: 工程里程碑 — 防御性基础设施
**文件**: [`tests/test_lookahead.py`](../../tests/test_lookahead.py)
**全历史复盘**: [iterations/v0.17.md](../../iterations/v0.17.md)

## 为什么需要

v0.16 完全靠 "IC 数字太夸张" 肉眼看出 MTF lookahead bug。下次可能不会这么走运。
需要机制化防御。

## 6 个测试覆盖

| 测试 | 目的 | 通过条件 |
|---|---|---|
| `test_oracle_ic_is_one` | 评估器自身正确 | IC=1.0 when factor == fwd_ret |
| `test_noise_factor_has_zero_ic` | 基础 lookahead 探测 | 高斯噪声 \|IC\| < 0.05 |
| `test_mtf_no_future_leak_h1_plus_h4` | v0.16 bug #1 专项 | IC(H1+H4) / IC(H1) < 4x |
| `test_mtf_no_future_leak_h1_plus_d1` | v0.16 bug #2 专项 | IC(H1+D1) / IC(H1) < 5x |
| `test_combiner_weights_are_shifted` | ic_weight shift(1) 验证 | 纯反转信号 \|IC\| < 0.1 |
| `test_lgbm_combiner_does_not_leak` | LGBM walk-forward 因果 | LGBM on noise \|IC\| < 0.05 |

## 验证：测试能否抓到 bug？

**实验**：临时 revert v0.16 fix，重跑测试

| 测试 | 有 fix | 无 fix |
|---|---|---|
| h1_plus_h4 | PASS ratio=0.72 | **FAIL ratio=29.1** |
| h1_plus_d1 | PASS ratio=0.52 | **FAIL ratio=15.9** |

**ratio 29x 和 16x 刚好对应 bug 的 IC 膨胀幅度**。测试精准抓到。

## 运行

```bash
python -m tests.test_lookahead
```

期望输出：`6 / 6 passed, 0 failed`。

## 设计原则

1. **ratio 测试 > 绝对阈值**: 比 IC=0.01 固定阈值稳定（数据无关）
2. **合成数据 > 真数据**: seed 固定的 `sample_intraday_panel` 完全 deterministic
3. **零依赖**: 纯 numpy / pandas，不需要 pytest
4. **分层结构**: oracle → noise → MTF → combiner 逐层升级，哪层失败能快速定位

## 生产用途

- CI 跑测：`python -m tests.test_lookahead` 非 0 exit → fail build
- pre-commit hook：每次 commit 前本地跑
- 开发新 alpha / combiner 时先跑确保无 regression

## 代码

见 [`tests/test_lookahead.py`](../../tests/test_lookahead.py)。
