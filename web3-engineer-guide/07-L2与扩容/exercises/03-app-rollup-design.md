# 练习 3：设计一条 app-rollup

## 目标

为一个**虚构应用**设计一条 L3 / app-rollup，把第 15 章的决策框架落到具体方案。

## 任务

从下列三个虚构场景中**任选一个**（或自己出一个），完成完整设计：

### 场景 A：链游 MMO

- 需求：日活 10 万，每人日均 100 次链上交易；
- 平均每笔小额道具 / NFT 操作；
- 用户无 web3 经验，要 web2 体验；
- 不接受 7 天提款延迟；
- 可以接受不同价值资产走不同 DA。

### 场景 B：高频衍生品 DEX

- 永续合约 + 期权；
- 大量 maker/taker 挂单与撮合；
- 需要近实时（< 1s）软确认；
- 大额持仓资金，不接受 DA 风险；
- 想要部分 MEV 利润回流给 LP。

### 场景 C：合规 RWA 平台

- 美债代币化 + 房地产；
- 需要 KYC / AML 合规接口；
- 监管资产，要银行级流程；
- 支持机构钱包；
- 可以与传统金融结算系统对接。

## 模板

```markdown
## App-Rollup 设计：<场景名>
设计者：<你的名字>
日期：2026-04-XX

### 1. 需求摘要
（用 5 句话讲清需求）

### 2. 框架选型
- 选择：OP Stack / Arbitrum Orbit / ZK Stack / Polygon CDK / Sovereign SDK
- 理由：

### 3. DA 选型
- 选择：Ethereum blob / Celestia / EigenDA / Avail / DAC / Volition
- 理由：
- 单笔 DA 成本估算：

### 4. Sequencer
- 模式：自营 / RaaS（Conduit/Caldera/Gelato）/ Shared（Espresso）
- 理由：
- 月成本估算：

### 5. 跨链与桥
- L1 ↔ App-Rollup：native bridge / 第三方
- App-Rollup ↔ 其他 L2：栈原生 interop / Hyperlane / LayerZero
- 入金通道：CCTP / OnRamp / 法币

### 6. Account 与 UX
- 钱包：标准 EOA / 4337 智能账户 / 自家集成
- gas 抽象：是否赞助 gas、是否允许用 stable 付 gas
- session keys：是否支持

### 7. 安全模型
- Stage 目标：0 → 1 → 2 路线
- Security Council 设置
- 升级 timelock

### 8. 经济模型
- L2 gas token：ETH / 自家 token
- sequencer 收入预期
- prover 成本（如选 ZK）
- 月度财务目标

### 9. 监控与告警
- L2BEAT 接入
- Hypernative / Forta 告警
- AI 异常检测

### 10. 上线时间表
- T0：架构定稿
- T+1 月：testnet
- T+3 月：mainnet beta
- T+6 月：Stage 1 路径完成
```

## 参考方案：场景 A 链游 MMO

```markdown
### 1. 需求摘要
日活 10 万、日均 1000 万 tx 的 MMO，需要近 web2 体验，不接受 7 天提款。

### 2. 框架
OP Stack（生态成熟、RaaS 友好、Superchain 互通）。

### 3. DA
EigenDA 主选（高吞吐、$730/年/100MB）；玩家大额装备走 Ethereum blob（Volition-like 自定义）。

### 4. Sequencer
启动期：Conduit 托管；DAU > 50 万后自营。

### 5. 桥
入金：CCTP (USDC) + 原生 ETH bridge；
跨链：Hyperlane（permissionless）+ LayerZero OFT（自家 GAME token）。

### 6. UX
4337 + Privy 内嵌钱包，邮箱注册；
gas 全免（厂商赞助）；
session keys 支持「日常 PvP 免签」。

### 7. 安全
Stage 0 启动 → Stage 1 在 6 个月内（fault proof + 抵押）。
Security Council 8 人，3 名外部独立成员。

### 8. 经济
L2 gas token：ETH（统一性优先）
收入：NFT mint fee 5% + 道具交易 2% + L1 提款 0.1 USDC 固定费
预计月收入 $100k–$500k

### 9. 监控
L2BEAT 接入；Forta 实时告警；自建 BI 看 sequencer 健康。

### 10. 时间表
T0：选型 / 设计；T+1m：testnet；T+3m：closed beta；T+6m：mainnet。
```

## 加分题

- 给场景 B（高频 DEX）做完整设计；
- 估算场景 A 第一年的总成本（infra + RaaS + audit）；
- 用 [Caldera](https://caldera.xyz/) 或 [Conduit](https://www.conduit.xyz/) 真在 testnet 部署一条 OP Stack rollup，记录从注册到 RPC 可用的全过程。
