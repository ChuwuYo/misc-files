# Noir 1.0 Poseidon 原像证明

与 `code/circom-poseidon/` 等价的逻辑，对比开发体验。

## 先决条件

```bash
# 装 nargo（Noir 工具链管理器）
curl -L noirup.dev | bash
noirup
nargo --version    # 应为 1.0.0-beta.x 或更高
```

## 跑通

```bash
nargo check                 # 类型检查 + 生成/校验 Prover.toml
nargo test                  # 跑 #[test] 块
nargo execute               # 跑 witness（输出在 target/）
nargo prove                 # 生成 proof
nargo verify                # 链下验证
```

## 链上验证（可选）

```bash
# 装 Barretenberg CLI
bbup
bb write_solidity_verifier -k target/vk -o ./Verifier.sol
```

得到的 `Verifier.sol` 可像 Circom 版本一样部署到 Anvil。

## 与 Circom 版本的差异

- 语法接近 Rust，没有 `<==` / `<--` / `===` 三套语义；
- 直接 `assert(h == expected_hash);`，编译器自动转成约束；
- `pub` 关键字标记公开输入，不需要单独 `component main { public [...] }` 声明；
- `nargo test` 让 ZK 电路也能像普通 Rust 单元测试一样跑。

## 注意

- Noir 1.0 仍在 pre-release（2026-02 起）；语言 spec 接近稳定但 std 部分库 alpha；
- `expected_hash` 需要与 Circom/circomlibjs 同算法计算才会一致——本目录 Prover.toml 给的是 `Poseidon(3, 5)` 在 BN254 上的真实输出（与 circomlib 一致）。
