# 练习 3：2022-05-25 Beacon Chain 7-block 重组复盘

> 写作要求：用工程语言，不超过 800 字，覆盖 时间线 / 根因 / 经验 / 自己的反思 4 段。
> 本文件是范例答案，实际练习请抄走自己重写一遍。

## 1. 时间线（UTC）

- 2022-05-25 08:55:23 — slot 3,887,074 之后的 slot 3,887,075 被一部分客户端识别为「迟到块」。
- 同一时刻，一部分客户端（已启用 proposer boost）把权重投给了新提议块；另一部分（未启用）继续按 LMD-GHOST 把权重投给老分支。
- 接下来 7 个 slot（3,887,075 - 3,887,081，约 84 秒），网络分裂成两条权重接近的链。
- 08:56:35 之后，权重较大的那条链胜出，另一边的 7 个块被 reorg。
- 当 epoch 边界到达时，Casper FFG checkpoint 仍按预期 justify/finalize；**finality 没有被破坏，只有 fork-choice 层抖动**。

## 2. 根因（三因合流）

1. **迟到的块提议**：proposer 出块比 attestation 截止时间晚，attesters 看到时已经在为「空 slot」投票。
2. **proposer boost 滚动升级不一致**：proposer boost（fork-choice 给当前 slot 的 proposer 块加 40% 委员会权重）当时是「软分叉」式可选升级，prysm/lighthouse/teku/nimbus 各客户端启用进度不同步，导致同一份链上的同一个块在不同客户端眼里权重不同。
3. **fork-choice 实现 bug**：部分客户端在计算 boost 时使用了「上一个 slot」的状态而不是「当前 slot」，进一步放大分歧。

任何单一因素都不会触发 reorg；三者叠加才造成 7 块连锁。

## 3. 经验

- **共识层面的"软升级"是危险的**。post-Merge 时代所有 fork-choice 改动必须打包进硬分叉，所有节点同时切换。这次事件是后续 EIP 流程把 fork-choice 改动归入硬分叉范畴的直接动因。
- **客户端多样性是双刃剑**。多客户端避免单一 bug 拖垮全网，但也意味着任何"局部优化"都要测多客户端互操作。
- **finality 与 confirmation 必须分清**。这次事件下，区块浏览器和交易所如果只看 head 就回滚交易；正确做法是等 2 个 epoch 的 finality（约 12.8 min）。Coinbase 当时把高价值 ETH 充值确认数从 12 个提到 65 个，正是这条经验的产品化。

## 4. 反思（练习者补完）

- 我现在跑 staking 节点，会把哪些指标接告警？
  - `chain_head_slot - chain_finalized_slot` > 3 epoch；
  - 同 epoch 内 reorg depth > 2；
  - peer count 突降；
  - 客户端版本 vs 网络主流版本 diff。
- 我做交易所/桥/MEV 的话，最低确认深度是多少？
  - 桥 / 大额：等 finality（justified + finalized 双 checkpoint）。
  - 普通：64 slot ≈ 12.8 min。
  - 注意 EIP-7251 之后 churn limit 变化对 finality 时间的间接影响。

## 参考资料

- Etherscan beacon explorer，slot 3,887,075 - 3,887,081（访问日期 2026-04-27）
- Barnabé Monnot, "Visualising the 7-block reorg on the Ethereum beacon chain"（访问日期 2026-04-27）
- ethresearch 论坛 "May 25 reorg" 讨论串（访问日期 2026-04-27）
