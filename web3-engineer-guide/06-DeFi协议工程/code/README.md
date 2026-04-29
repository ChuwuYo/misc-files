# 模块 06 实战代码

四个 Foundry 项目，全部基于 fork mainnet 模式。

## 通用前置

```bash
# 安装 foundry（一次性）
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 复制环境变量
cp .env.example .env
# 填入：MAINNET_RPC_URL、ARB_RPC_URL、PRIVATE_KEY（仅 testnet 用）
```

`MAINNET_RPC_URL` 推荐用 Alchemy / QuickNode / Infura 的 archive endpoint（fork 历史块需要 archive 节点）。

## 项目清单

| 目录 | 内容 | 关键命令 |
|------|------|---------|
| `univ2-pool/` | 从零写 UniswapV2-style 池子 | `forge test` + `forge snapshot --diff` |
| `chainlink-liquidator/` | Aave V3 fork 主网清算 + Chainlink 价格筛选 | `forge test --fork-url $MAINNET_RPC_URL --fork-block-number 19500000` |
| `sandwich-sim/` | viem + Foundry fork 三明治模拟（仅教学） | `pnpm install && pnpm sim` |
| `erc4626-vault/` | 抗 inflation attack 的 yield vault + invariant | `forge test --match-contract Invariant -vvv` |

每个项目下 `README.md` 有详细的 fork 块号与运行步骤。

> **法律提示**：sandwich-sim 仅用于研究和审计教学，不要用于主网生产。
