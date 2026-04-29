# SP1 zkVM Fibonacci

用 SP1（Succinct Labs 的开源 zkVM）证明「fib(n) 算对了」。

## 先决条件

```bash
# 1. Rust 1.80+
rustup update

# 2. SP1 工具链（cargo prove + sp1-up）
curl -L https://sp1.succinct.xyz | bash
sp1up
```

## 跑通

```bash
# 编译 guest 程序到 RISC-V ELF
cargo prove build --bin fibonacci-program -p program

# 跑 host：默认 n=20
cargo run --release -p fibonacci-script

# 自定义 n
cargo run --release -p fibonacci-script -- 100
```

期望输出：

```
OK: n=20, fib(n)=6765
```

## 链上验证（可选）

```bash
# 用 SP1 Network 远程 prover 出 Groth16 wrap proof（~250B）
SP1_PROVER=network NETWORK_PRIVATE_KEY=0x... cargo run --release -p fibonacci-script -- 20
```

得到的 proof bytes 可发到 SP1 提供的 Solidity verifier。

## 文件结构

```
sp1-fib/
├── Cargo.toml          (workspace)
├── program/            (guest, 编译成 RISC-V)
│   ├── Cargo.toml
│   └── src/main.rs
└── script/             (host, 调 prover)
    ├── Cargo.toml
    ├── build.rs
    └── src/main.rs
```

## 性能参考（2026-04）

- 默认配置（CPU AVX2）：n=100 约 ~10 秒；
- GPU（CUDA）：n=10000 约 ~1 分钟；
- SP1 Hypercube + 16×RTX5090：可在 12 秒内证完一个 ETH L1 区块。
