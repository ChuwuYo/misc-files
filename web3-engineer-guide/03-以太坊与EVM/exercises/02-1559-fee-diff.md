# 练习 02 — EIP-1559 前后的费用差异

## 题目

设你想在主网把一笔标准的 USDC 转账（gas_used = 65,000）打包进区块。

**情景 A（2021-08 之前，legacy fee market）**：

- 你的钱包估出 gas price = 70 gwei
- 矿工按 first-price auction 接

**情景 B（EIP-1559 后）**：

- 当前 baseFee = 50 gwei
- 你设 maxPriorityFeePerGas = 5 gwei
- 你设 maxFeePerGas = 70 gwei

请回答：

1. 情景 A 你付多少 ETH？谁拿了？
2. 情景 B 你付多少 ETH？多少烧毁？多少给提议者？
3. 如果同一区块里 baseFee 涨到 75 gwei，情景 B 的交易会发生什么？
4. 为什么 1559 让用户体验更好？

---

## 解答

### 1. 情景 A（legacy）

```
fee = gas_price × gas_used
    = 70 × 10^9 × 65000
    = 4,550,000 × 10^9 wei
    = 0.00455 ETH
```

全部归矿工。1559 之前没有 burn 概念。

> 副作用：legacy 模式下用户必须**自己竞价**，钱包要"建议 gas price"。需求暴涨时大家集体抬价 → 区块拥堵 → MEV bot 抢着塞钱给矿工。

### 2. 情景 B（EIP-1559）

```
gas_price = min(maxFeePerGas, baseFee + maxPriorityFeePerGas)
          = min(70, 50 + 5) = 55 gwei

fee   = 55 × 10^9 × 65000 = 0.003575 ETH        ← 你付这么多
burn  = 50 × 10^9 × 65000 = 0.00325  ETH        ← 烧毁
tip   =  5 × 10^9 × 65000 = 0.000325 ETH        ← 给提议者
```

省了 0.000975 ETH（约 21.4%）。

注意：`baseFee × gas_used` 这部分被协议直接从 sender 余额抹掉，不进任何账户——等价 ETH 总量减少。这是 ETH "ultrasound money" 叙事的根。

### 3. baseFee 飙到 75 gwei 会怎样

`maxFeePerGas = 70 < baseFee = 75`，**这笔交易根本进不了区块**。它会在 mempool 里挂着，等下一个 baseFee 回落到 ≤ 70 的区块才能被打包。

实际钱包会建议：

- 如果 baseFee 涨势剧烈，**重发一笔同 nonce 但更高 maxFeePerGas 的交易**（"speed up"）
- 或者重发一笔同 nonce、to=self、value=0、gas=21000 的"取消"交易

### 4. 为什么 1559 体验更好

1. **baseFee 由协议自动算**，钱包不再需要竞价 oracle
2. **超出 baseFee 的部分自动退回**——你设 maxFee=70 不一定真付 70，按 baseFee+tip 实际收
3. **预测性强**：baseFee 每块最多 ±12.5%，钱包可以稳定建议
4. **MEV 减少**：tip 是给提议者的钱，提议者按 tip 排序而非 gasPrice 全包，减小套利价值
5. **通缩**：burn 让 ETH 减少发行净值

### 5. 一个对照表（不同 maxPriority 的情形）

baseFee = 50 gwei，gas_used = 65000：

| maxFee | maxPriority | gas_price | total | burn | tip |
|---|---|---|---|---|---|
| 70 | 0 | 50 | 0.00325 | 0.00325 | 0 |
| 70 | 2 | 52 | 0.00338 | 0.00325 | 0.00013 |
| 70 | 5 | 55 | 0.003575 | 0.00325 | 0.000325 |
| 70 | 25 | 70（封顶） | 0.00455 | 0.00325 | 0.0013 |
| 100 | 50 | 100 | 0.0065 | 0.00325 | 0.00325 |

注意第四行：当 `baseFee + maxPriority > maxFee` 时，gas_price 被 maxFee 封顶，**实际 tip 自动减少**。这叫 "tip clamping"。

完成后请回到 [README §4 Gas 模型](../README.md#4-gas-模型) 巩固。
