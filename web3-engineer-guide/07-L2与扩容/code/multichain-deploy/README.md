# Demo 1：多链部署 + gas 对比

## 目标

把同一份 `Counter.sol` 部署到 5 条测试网，自动产出 gas 对比表：

- Ethereum Sepolia（L1 baseline）
- Base Sepolia（OP Stack）
- OP Sepolia（Optimism）
- zkSync Sepolia（ZK Type-4）
- Scroll Sepolia（ZK Type-2）

> [!NOTE]
> 截至 2026-04，zkSync 的 Foundry 适配仍需要 `foundry-zksync` 工具链；其他链用标准 Foundry 即可。

## 目录结构

```
multichain-deploy/
├── foundry.toml          # Foundry 多链配置
├── src/
│   └── Counter.sol       # 被部署的测试合约
├── script/
│   └── Deploy.s.sol      # 部署脚本
├── scripts/
│   ├── deploy-all.sh     # 一键部署到所有 5 条链
│   └── gas-report.sh     # 生成对比表
└── .env.example          # RPC / private key 配置模板
```

## 快速开始

```bash
# 1. 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# 2. （仅 zkSync）安装 foundry-zksync
curl -L https://raw.githubusercontent.com/matter-labs/foundry-zksync/main/install-foundry-zksync | bash

# 3. 拷贝环境变量
cp .env.example .env
# 编辑 .env，填入各链 RPC 和测试 private key（务必用测试钱包！）

# 4. 一键部署
./scripts/deploy-all.sh

# 5. 看对比表
cat gas-report.md
```

## 期望产出

`gas-report.md` 大致如下（数字会变动，仅作示例）：

| Chain | Deploy gas | Increment gas | L2 gas price (gwei) | 预估单次 cost (USD) |
|---|---:|---:|---:|---:|
| Ethereum Sepolia | 145,000 | 43,000 | 20 | $2.50 |
| OP Sepolia | 142,000 | 43,000 | 0.001 | $0.0001 |
| Base Sepolia | 142,000 | 43,000 | 0.001 | $0.0001 |
| Scroll Sepolia | 144,000 | 43,000 | 0.05 | $0.002 |
| zkSync Sepolia | 167,000 (zk-friendly) | 41,000 | 0.025 | $0.001 |

## 关键观察

1. **L2 部署 gas 与 L1 几乎相同**——Bedrock/Nitro 都是 EVM 等价；
2. **zkSync gas 略高**——因为 EraVM 不是 EVM，pubdata 计费方式不同；
3. **真实成本差距 1000×+**——L2 不是"L1 打折"，是"L1 的不同维度"；
4. **跑同样合约**最能对比 sequencer 的真实计价策略。

## 进阶练习

- 把 Counter 改成 ERC20 transfer，再跑一遍，看 calldata 大小如何影响 DA 成本占比；
- 把 deploy-all.sh 加上 `Arbitrum Sepolia`，对比 Arbitrum 计价（`L2_GAS + L1_DATA_GAS` 模型）；
- 把结果存到 SQLite，画一个时间序列图，看 blob price 波动如何影响 rollup 成本。
