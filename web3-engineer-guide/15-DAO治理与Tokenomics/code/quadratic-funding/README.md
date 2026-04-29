# Quadratic Funding 实现

## 公式

$$
M_p = \left(\sum_{i=1}^N \sqrt{c_i}\right)^2 - \sum_{i=1}^N c_i
$$

## 文件

- `qf.ts` — 算法（pure QF / Sybil-discount / pairwise-bounded）
- `qf.test.ts` — Vitest 测试

## 运行

```bash
npm install
npm test
```

## 三种变体

1. **pure QF**（Vitalik / Buterin / Weyl 2018）：`(Σ√c)² - Σc`
2. **Sybil-discount QF**（Gitcoin Passport 思路）：每个 donor 有 trust score ∈ [0, 1]，捐款被 trust 加权
3. **Pairwise-bounded QF**（Vitalik 2019 [Pairwise Coordination Subsidies](https://vitalik.eth.limo/general/2019/10/01/quadratic.html)）：限制任意 donor pair 的"协同效应"

## 真实 Gitcoin 用什么

Gitcoin 当前主要使用 **COCM（Connection-Oriented Cluster Match）**：
- 检测"互相高频共同捐款"的 cluster
- 对一个 cluster 整体的贡献做折扣
- 比 pairwise-bounded 更适合大规模 round

参考：[Gitcoin QF support](https://support.gitcoin.co/gitcoin-knowledge-base/gitcoin-grants-program/mechanisms/quadratic-funding)。
