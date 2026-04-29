# Damn Vulnerable DeFi v4 · 思路指引（不直接放答案）

> 这份文件**只给方向**，不给可拷贝代码。如果你直接复制 GitHub 上的 solutions repo 跑通，等于读了一本武侠小说而不曾习武。**先卡在题目上 60-120 分钟再来读这里**。
>
> 推荐至少完成 §1 / §2 / §6 / §17 这 4 关后再去 Code4rena 参赛。

## 1. Unstoppable

**题目本质**：让一个声称"flash loan 永远可用"的 vault 拒绝服务。

**思路指引**：
- vault 内部用了某个 invariant 检查（例如 `convertToShares(totalSupply) == totalAssets`）。
- 你能不能从外部**只用 1 wei** 让这个 invariant 不成立？
- 不需要重入，不需要复杂攻击。看 `flashLoan` 函数前几行的 `require`，问"这条 require 依赖什么？我能不能让它依赖的东西不一致？"
- 关键词：直接 `transfer` 给 vault（绕开 deposit 函数）。

## 2. Naive Receiver

**题目本质**：在不需要受害者 receiver 同意的情况下，把它的 ETH 全部用 flash loan fee 烧掉。

**思路指引**：
- flash loan 的 fee 是固定 1 ETH。Receiver 的 balance 是 10 ETH。
- 你能不能让 receiver 接连接受 10 笔 flash loan？
- 谁规定 flash loan 必须由 receiver 自己发起？
- v4 引入了 meta-transaction (BasicForwarder)，多想想为什么——这个版本在原来基础上加了一层 forwarder，让一笔操作可以打包多次调用。

## 3. Truster

**思路指引**：
- 一笔交易内必须把所有 token 转走。
- flash loan 允许你在 callback 里执行任意 calldata。
- 任意 calldata 等于"任意函数调用"——在受害者合约的上下文中。
- 你能不能让它**自己**调 `approve(你, max)`？

## 5. The Rewarder（v4 重做版）

**思路指引**：
- 用 Merkle tree 分发奖励。每个用户对应一个叶子。
- 时间敏感：在某个窗口内可以 claim。
- 你需要找一个**已经过期但仍然 valid** 的 proof，或者一个**重复 claim** 的路径。
- 关键词：bit packing、claim 状态记录方式、Merkle 重排。

## 8. Puppet

**思路指引**：
- Lending pool 用 UniswapV1 价格估值。
- UniswapV1 是几乎没人用的链上 AMM——意味着流动性极低。
- 流动性低 + spot price ⇒ 你懂的。

## 11. Backdoor

**思路指引**：
- Safe wallet 部署时可以指定一个 `setupModule`。
- 这个 module 是被 delegatecall 的——也就是说在 wallet 自己的上下文执行。
- 你部署 4 个 wallet，每个都"代理"用户去领 token。
- 但这 4 个 wallet 都设置了一个会**把 token 立即转走**的 module。
- 关键词：`Safe.setup` 的 `to + data` 参数，你的 module 长什么样。

## 12. Climber

**思路指引**：
- Timelock 系统：proposer 可以提案 + 立即执行（如果延迟为 0）。
- 这是个 UUPS proxy，可以被升级。
- 你能不能用 timelock 自己升级到一个新的 implementation？
- 关键词：execute 函数检查 op 的顺序——它先 execute 再 check。
- 你能在 execute 里把自己加进 proposer，然后 schedule 一个新提案，然后 execute 它。

## 14. Puppet V3

**思路指引**：
- UniswapV3 有 TWAP，但 TWAP 窗口是可调的。
- 短窗 TWAP 仍可被多块攻击。
- 你需要让区块时间快进——本地 fork 用 `vm.warp(...)`。
- 关键词：`observe()` 时间戳处理、tick liquidity 不是无限。

## 17. Curvy Puppet（v4 新关）

**题目本质**：Curve pool 的 read-only reentrancy。

**思路指引**：
- Curve `remove_liquidity` 在转 ETH 时，状态还没更新到正确值。
- 受害者合约 (Lending) 在你的 fallback 内调用了 Curve 的 `get_virtual_price()`。
- 这一刻 LP 价格是脏的——比真实低 30%。
- 你的策略：让脏价格让你能 borrow 比应得更多，或让 healthFactor 看起来 ok 但其实不 ok。
- 必读：[CertiK 复盘 dForce 案](https://www.certik.com/resources/blog/curve-conundrum-the-dforce-attack-via-a-read-only-reentrancy-vector-exploit)。

## 18. Withdrawal（v4 新关）

**思路指引**：
- L2 → L1 桥提现：经过一段时间窗后才能在 L1 释放。
- 时间窗内有人能挑战。
- 但题目让你扮演"作恶的 L2"——能不能在 L1 上 mint 出更多代币？
- 关键词：Merkle proof 的构造、validator set 变更、replay。

---

## 通用做题方法

1. **先读 README 与单测**：题目通常有 `forge test --match-test test_assert*` 写好的 victory 条件。
2. **fork mainnet 调试**：DVD v4 全 Foundry，`forge test -vvvv` 看完整 trace。
3. **从受害者合约开始读**：你要打的是它，不是攻击者模板。
4. **用 mermaid 画状态变化图**：纸笔比 IDE 清晰。
5. **失败时不要立刻看答案**：去搜对应漏洞类型的真实事件复盘（rekt.news），看看这一类真实攻击怎么发生，再回头做。
