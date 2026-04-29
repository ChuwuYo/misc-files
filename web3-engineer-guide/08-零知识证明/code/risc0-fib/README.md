# Risc0 zkVM Fibonacci

与 `code/sp1-fib/` 等价的逻辑，对比 Risc0 vs SP1 体感。

## 先决条件

```bash
# Rust 1.80+
rustup update

# Risc0 工具链
cargo install cargo-risczero
cargo risczero install
```

## 跑通

```bash
cargo run --release            # 默认 n=20
cargo run --release -- 100
```

期望输出：

```
OK: n=20, fib(n)=6765
```

## 文件结构

```
risc0-fib/
├── Cargo.toml          (workspace)
├── methods/            (含 guest，编译成 RISC-V)
│   ├── Cargo.toml
│   ├── build.rs
│   ├── src/lib.rs
│   └── guest/
│       ├── Cargo.toml
│       └── src/bin/fib_guest.rs
└── host/               (调 prover)
    ├── Cargo.toml
    └── src/main.rs
```

## 与 SP1 的关键差异

- Risc0 host 用 `default_prover()` 自动选 CPU/GPU/Bonsai；SP1 用 `ProverClient::from_env()`；
- Risc0 把 commit 内容放在 `journal`，可直接 `receipt.journal.decode()` 解出；SP1 用 `proof.public_values.read::<T>()` 顺序读；
- Risc0 的 ELF + ImageID 由 `risc0-build` 在编译期通过 `methods.rs` 注入；SP1 用 `include_elf!` 宏。

## 性能参考（2026-04）

- CPU baseline：n=10M（loop iterations） 约 19m10s；
- GPU（RTX 4090）：~2 分钟；
- Bonsai 远程 prover：取决于队列，一般几十秒到几分钟。
