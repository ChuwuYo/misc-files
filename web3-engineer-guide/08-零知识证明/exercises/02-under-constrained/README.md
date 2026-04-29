# 练习 2：找 under-constrained 漏洞

## 任务

`buggy.circom` 提供一个看似正常的 `IsZero` 电路，它有一个经典的 under-constrained bug。

1. 找出漏洞行；
2. 给出 fix（最小改动）；
3. 用 `circomspect` 与 `picus` 扫描确认 fix；
4. 在 `notes.md` 写下 30-100 字解释。

## 提示

- circom 的 `<--` 表示「赋值但不加约束」；`<==` 表示「赋值并约束」；`===` 是纯约束等号；
- 仅靠 `in * out === 0` 这一条约束，恶意 prover 能否在 `in ≠ 0` 时让 `out` 取一个让 verifier 接受的值？
- 标准 fix（在 `circomlib/comparators.circom` 的 `IsZero` 实现里）是再加一行约束：

```circom
// 把 inv 也锁死，让 prover 没法选别的 inv
in * inv === 1 - out;
```

为什么这一行让漏洞消失？

## 工具

```bash
# circomspect（Trail of Bits）
cargo install circomspect
circomspect buggy.circom

# Picus（Veridise）：见官方文档
# 或在 zkSecurity 的 ZKAP 里有等价工具
```

## 触类旁通：真实漏洞案例

- 2023 Aztec Connect 多重花费 bug：integer division 的余数没约束 → 类似的「自由度残留」；
- 2022 Hermez 双花 bug：under-constrained；
- ZK Email 早期版本：邮箱地址 under-constrained → 攻击者证「假 email」；
- 0xPARC zk-bug-tracker 收录的 90%+ 漏洞都属于这一类。

## 写 notes.md 时的 checklist

- 解释清 `<--` vs `<==` 的差别；
- 说明在原始电路里恶意 prover 的「自由度」具体在哪；
- 说明 fix 后这个自由度被锁死的原理（提示：现在 inv 必须满足 `in * inv = 1 - out`，而 out 又被原约束 `in * out = 0` 锁，两条联立 → inv 唯一）。
