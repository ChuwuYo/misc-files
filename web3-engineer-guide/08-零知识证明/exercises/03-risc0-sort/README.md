# 练习 3：Risc0 zkVM 证明排序

## 任务

写一个 guest 程序：

1. 读入一个 `Vec<u32>`；
2. 排序；
3. 把 `(input_hash, sorted)` commit 到 journal；
4. host 端 verify 后能拿到 sorted。

`methods/guest/src/bin/sort_guest.rs` 给出脚手架，三个 `TODO`：

- TODO 1：克隆并排序；
- TODO 2：用 Risc0 SHA256 precompile 算 input/output 的哈希；
- TODO 3：把 `(input_hash, sorted)` commit 到 journal。

## 跑

```bash
# 装 Risc0
cargo install cargo-risczero
cargo risczero install

# 跑
cargo run --release
```

期望输出：

```
OK: sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## 进阶

- 把 SHA256 改成 Keccak（Risc0 v3 起原生 precompile）比较 cycle 数；
- 在 guest 里加 assertion：sorted 是 input 的 permutation **且** 非降序，防止 prover 配假数据；
- 把排序换成更复杂的算法（merge sort），观察 prover 时间。

## 为什么 commit input_hash 而不是 input

journal 是公开的（receipt 一部分）。如果直接 commit input，那 input 就会暴露——失去 ZK 价值。

如果根本不 commit input 相关信息，host 拿到 sorted 后无法判断它确实来自给定的 input。

折中：commit input 的哈希。host 自己已经知道 input，重算哈希比对。这样既不泄露多余信息，又能绑定输入输出。
