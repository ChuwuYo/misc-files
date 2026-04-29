# 练习 1：单笔交易成本拆解

## 目标

学会把一笔 L2 交易的真实成本，**拆**成 execution + DA + proof 三段，并对比 L1 / Optimistic / ZK 的差异。

## 任务

对同一笔 Uniswap v3 swap 交易（在 L1 与各 L2 上做相同的逻辑），拆出每一段成本。给定参数：

- swap 占 calldata 约 **400 bytes**，经 brotli 压缩到 **~200 bytes**；
- L2 execution gas：**~150,000 gas**；
- L1 baseline：gas price 20 gwei，ETH = $3,000；
- L2 gas price：0.001 gwei（典型 OP / Base，截至 2026-04）；
- Blob 容量（BPO2，2026-01-07 起）：14 blobs × 128 KiB = **1.75 MiB / 12s slot**；
- Blob base fee（截至 2026-04，[ethPandaOps](https://ethpandaops.io/posts/eip7691-retrospective/)）：**约 1 wei**；
- ZK proof 摊销成本（截至 2026-04）：**$0.0005–$0.005 / tx**。

请算出：

1. **L1 主网**总费用（USD）；
2. **Optimistic Rollup（Base）**总费用（USD），分段：execution + DA；
3. **ZK Rollup（Scroll）**总费用（USD），分段：execution + DA + proof。

并回答：

- 哪一段是当前的成本中心？
- 如果 blob_base_fee 飙升 1000 倍，结论会怎样变？
- 为什么 ZK 比 Optimistic 贵 3-10×？

## 参考答案

### 场景 1：L1

```
total = 150,000 gas × 20 gwei = 3 × 10^6 gwei
     = 0.003 ETH
     ≈ $9（按 ETH = $3,000）
```

### 场景 2：Base（Optimistic）

```
execution = 150,000 × 0.001 gwei = 1.5 × 10^5 gwei = 1.5 × 10^-4 ETH ≈ $0.45
（注意：实际 L2 gas price 通常 0.001-0.01 gwei，这里取低端）

DA：
  blob_gas_per_blob = 131,072
  per blob 价格 ≈ 1 wei × 131,072 = 131,072 wei ≈ 0
  本笔占比 = 200 / (1.75 × 1024 × 1024) ≈ 1.1 × 10^-4
  本笔 DA ≈ 几乎 0

total ≈ $0.0005-0.001（取决 L2 gas price 实际定价）
```

> 实际 Base 上类似 swap 的真实费用截至 2026-04 在 $0.005-$0.05 区间——上面计算的是「成本」，user 实际付的还包括 sequencer 加价（priority fee + 利润）。

### 场景 3：Scroll（ZK）

```
execution ≈ 同 Optimistic ≈ $0.0005
DA ≈ 同上 ≈ 0
proof 摊销 ≈ $0.0005–$0.005
total ≈ $0.001–$0.006
```

### 关键见解

> [!IMPORTANT]
> 1. **L1 vs L2 差距 ~1000–10000×**——这就是「为什么需要 L2」的全部答案；
> 2. **Optimistic 与 ZK 当前差距 ~3–10×**——主要来自 prover 摊销；
> 3. **Pectra/Fusaka 后 DA 已不是成本中心**，execution 与 prover 才是。

### 加分题

- 如果 blob_base_fee 飙升到 1000 gwei，Base 单笔 DA 成本是多少？答：**~$5+**（一笔 swap 的 DA 接近原 L1 成本，rollup 利润被 DA 吃光）；
- 这就是为什么 Pectra + Fusaka 把 blob 容量翻 5 倍很重要——避免「blob 拥堵」让 L2 价格回到 4844 之前。
