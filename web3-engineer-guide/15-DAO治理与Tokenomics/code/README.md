# 模块 15 代码索引

| 目录 | 内容 | 章节对应 |
|------|------|---------|
| `governor-foundry/` | OZ Governor + Timelock + ERC20Votes 完整 DAO（Foundry） | 第 8、27 章 |
| `ve-token/` | Curve 风格 vote-escrow 简化合约 | 第 15、18 章 |
| `quadratic-funding/` | QF 算法 + Sybil 折扣（TypeScript） | 第 12、28 章 |
| `erc3643-simple/` | ERC-3643 许可型代币简化版 | 第 22、28 章 |
| `safe-foundry-fork/` | Safe（Gnosis Safe）Foundry fork 模拟 | 第 10 章 |
| `snapshot/` | Snapshot 投票脚本（snapshot.js） | 第 6 章 |

## 工具链版本（pin 2026-04）

- Foundry: nightly 2026-04 / forge 1.x
- Solidity: 0.8.28
- OpenZeppelin Contracts: 5.0.x
- viem: 2.43.3
- Snapshot.js: ^0.12

## 运行方法（公共）

```bash
# Foundry 项目
cd governor-foundry
forge install
forge test -vvv

# TypeScript 项目
cd quadratic-funding
npm install
npm test
```
