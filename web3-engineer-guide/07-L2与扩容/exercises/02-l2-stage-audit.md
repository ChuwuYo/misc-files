# 练习 2：L2 Stage 评级解读

## 目标

学会读 L2BEAT 上一条 L2 的 stage 评级，找出真实的信任假设，写一份 audit 报告。

## 任务

任选下列 L2 之一（建议覆盖光谱里的极端样本）：

- **Arbitrum One**（最成熟 Stage 1） — [L2BEAT](https://l2beat.com/scaling/projects/arbitrum)
- **Base**（最大流量 Stage 1） — [L2BEAT](https://l2beat.com/scaling/projects/base)
- **Scroll**（首个 ZK Stage 1） — [L2BEAT](https://l2beat.com/scaling/projects/scroll)
- **zkSync Era**（Stage 0 + Volition） — [L2BEAT](https://l2beat.com/scaling/projects/zksync-era)
- **Blast**（Stage 0 + 无 fraud proof） — [L2BEAT](https://l2beat.com/scaling/projects/blast)

完成下面这份 audit 模板（截至 2026-04）。

## 报告模板

```markdown
## L2 Stage Audit: <L2 名称>
日期：2026-04-XX
评估者：<你的名字>

### 1. 基本信息
- Stage（截至本日）：
- 类型（Optimistic / ZK / Validium）：
- 证明系统：
- DA：
- TVL：
- L2BEAT 链接：

### 2. Risk Rosette 五维（颜色：绿/黄/橙/红）
- State Validation：
- Data Availability：
- Exit Window：
- Sequencer Failure：
- Proposer Failure：

### 3. Permissions（多签 / Security Council）
- Security Council 人数：
- 多签门槛：
- 是否包含外部独立成员（非 founding team）：
- multisig 私钥分布（同一组织 / 跨组织 / 跨地理）：

### 4. Contracts
- Proxy admin：
- 升级 timelock 长度：
- 紧急升级权（emergency upgrade）：

### 5. 距离下一 Stage 还差什么
列出 L2BEAT 项目页底部「Stage upgrade requirements」清单。

### 6. 实测 stress
- 历史 sequencer 宕机次数：
- 是否经历过紧急升级：
- 是否有过「force-inclusion」实战：

### 7. Trust Assumption 一句话总结
「相信 ___，相信 ___ 数学，相信 ___ 不作恶。」

### 8. 给「准备把 $10M 放进去」的人的建议
（写 3-5 句简洁建议）
```

## 示范答案（节选）：Arbitrum One，2026-04

```markdown
## L2 Stage Audit: Arbitrum One
日期：2026-04-XX

### 1. 基本信息
- Stage：Stage 1（BoLD permissionless 已上线）
- 类型：Optimistic Rollup（Nitro）
- 证明系统：fraud proof（BoLD 二分博弈）
- DA：Ethereum blob
- TVL：~$16.84B（来源 L2BEAT）

### 2. Risk Rosette
- State Validation：黄（接近绿，因 BoLD 但 SC 仍可干预）
- Data Availability：绿
- Exit Window：黄
- Sequencer Failure：黄（force-inclusion 12h 延迟）
- Proposer Failure：黄

### 3. Permissions
- Security Council 12 人，多签 9/12，含外部成员
- multisig 跨组织、跨地理

### 5. 距离 Stage 2 还差
- Security Council 不能任意升级合约（需 demonstrable bug）；
- 移除 instant upgrade 权限；
- prover 系统完全自治（已大部分达到）。

### 7. Trust Assumption
「相信至少有 1 个诚实挑战者，相信 BoLD 数学，相信 Security Council 12/9 多签不会同时被攻陷。」

### 8. 给 $10M 投资者的建议
1. 当前 L2 中信任假设最少之一，可以放心；
2. 长期资金：等 Stage 2 后再加大；
3. 大额跨链回 L1 用 native bridge（7 天）；急用走 Across；
4. 关注 Security Council 治理提案。
```

## 加分题

- 对比 Arbitrum 与 Linea 的 Stage 评级差异，解释「为什么 ZK 不一定 = 更高 Stage」；
- 找一条 L2BEAT 上「stage 0 + DA 红色」的链（如 [Blast](https://l2beat.com/scaling/projects/blast) 早期），写一份风险警告。
