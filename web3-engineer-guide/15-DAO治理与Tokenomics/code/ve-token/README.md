# VeToken — Curve VotingEscrow 简化版

## 教学目标

- 理解 ve 模型的核心数学：`ve = amount × (remaining / MAX_LOCK)`
- 掌握"线性衰减"为何对 mechanism design 重要
- 理解为何 ve 不可转账（一旦可转账，long lock 的人会立刻在二级市场出售时间溢价）

## 文件

- `VeToken.sol` — 简化合约（约 100 行）
- `VeToken.t.sol` — Foundry 测试

## 与真实 Curve VotingEscrow 的差距

本合约**只支持 balanceOf(user)**（当前余额）。真实 Curve 还有：
- `balanceOfAt(user, blockNumber)` — 历史快照（用于 governance）
- `totalSupplyAt(blockNumber)` — 全局历史快照
- `epoch / slope_changes` — O(log N) 全局供应量计算
- Smart wallet whitelist — 限制合约持有 ve（防止 wrap 协议破坏 game theory）

完整实现请参考 [Curve VotingEscrow.vy](https://github.com/curvefi/curve-dao-contracts/blob/master/contracts/VotingEscrow.vy)。
