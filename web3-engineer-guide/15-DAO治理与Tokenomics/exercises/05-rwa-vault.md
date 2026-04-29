# 习题 05：RWA 工程 — 部署许可型代币 + 接入 Safe

## 题目

你被一家想发"代币化美国短期国债"的金融科技公司聘请。技术目标：

- (a) ERC-3643 兼容（许可型转账）。
- (b) 在 Ethereum + Base 双链发行（cross-chain）。
- (c) 与 Aave 集成作为抵押品（isolated mode）。
- (d) DAO Treasury 持有部分代币（用于 yield 策略）。
- (e) 监管要求：可强制转账 / 暂停 / 冻结。

请回答：
1. 列出至少 7 个工程设计决定。
2. 给出合约层和 off-chain 层各自的关键挑战。
3. 接入 Aave 时为什么要用 isolated mode？

---

## 解答骨架

### 1. 七个工程决定

#### 决定 1：Identity Registry 单 source of truth
- 部署 IdentityRegistry 在 Ethereum（主链）。
- Base 上的 token 通过 LayerZero / CCIP 同步 KYC 状态。
- 缺点：跨链同步延迟（< 5 分钟）。

#### 决定 2：Compliance Module 多个子规则
- 转账上限：每地址每天 100 万美元。
- 地理：拒绝来自 OFAC SDN list 国家。
- 黑名单：可手动加入 frozen 列表。
- 投资者类型：仅"qualified institutional buyer"。

#### 决定 3：Oracle / NAV 报告
- 每日 NAV 由托管方（State Street / BNY）签名上链。
- 链下储备金证明 + Chronicle 验证层（参考 BUIDL）。
- 异常波动 (>5%) 触发 pause。

#### 决定 4：赎回机制
- T+1 链下赎回（持有者 → 协议 → 托管方 → 银行电汇）。
- 链上"instant redeem to USDC" 流动性池（限额 + 滑点保护）。

#### 决定 5：跨链 wrapping
- Base 上的 RWA token 实际是 wrapper：lock on Ethereum → mint on Base。
- 用 Wormhole / LayerZero（参考 BUIDL 的 Securitize 跨链方案）。

#### 决定 6：Aave isolated mode
- Aave V3 isolated mode：单 collateral type，独立 LTV。
- LTV 50%（保守，因为 RWA 二级市场流动性比 ETH 差）。
- liquidation threshold 70%。
- liquidation bonus 5%（吸引清算人）。
- borrow cap：1000 万美元（限制对 Aave 整体的风险敞口）。

#### 决定 7：紧急 pauser
- 5/7 多签：核心团队 2 + 法律顾问 1 + 托管方 1 + 监管联络 1 + 审计 1 + 社区代表 1 + 备用。
- 任意 5 人可触发 pause。
- pause 后不能 transfer，但可 redeem（保护持有者）。

#### 决定 8（可选）：DAO Treasury 接入
- DAO Treasury 通过 Safe 5/9 持有 RWA token。
- 投票通过的提案 → Timelock → Safe execTransaction → 转 RWA 给目标策略合约。

### 2. 合约层挑战

```
合约层挑战：
1. _update hook 必须 gas 高效（每次 transfer 都跑两次 verified 检查）
2. forced transfer 必须可审计（emit 详细事件）
3. cross-chain wrapper 必须防止"双花"（wrap + unwrap 时序问题）
4. NAV 报告 oracle 必须 multisig（避免单点）

Off-chain 挑战：
1. KYC 数据存哪？（GDPR + 7 年保存要求 vs 链上不可删除）
2. 托管方报告造假怎么发现？（链上自动 alert + 第三方审计）
3. 监管沟通谁负责？（compliance officer 角色）
4. 监管命令"立刻冻结某地址" 24 小时响应（运维 SLA）
```

### 3. 为什么 Aave isolated mode

Aave V3 isolated mode 把 RWA 抵押品的风险**与其他抵押品池子隔离**：
- 即使 RWA 合约出 bug 或 NAV 错算，也不会影响 ETH/USDC 借贷池。
- borrow cap 限制了"如果 RWA 失稳，最多多少 USDC 受影响"。
- LTV 较低（50% vs ETH 的 80%）反映"RWA 流动性更差，清算更慢"。

实际上 BlackRock BUIDL 进入 Aave 也是用 isolated mode（参考 Aave V3 的 institutional market）。

### 4. 上线 checklist

```
✅ 合约审计 ≥ 2 家（OpenZeppelin / Trail of Bits / Spearbit）
✅ 法律意见书（含 SEC + MiCA + 司法辖区分析）
✅ SPV 结构（链下持有的实际美国国债）
✅ 月度透明度报告（持仓 / 赎回 / 利息）
✅ Bug Bounty 至少 100 万美元
✅ 监管沟通建立（SEC / FCA / MAS / etc.）
✅ Aave / Compound / Morpho 等借贷协议沟通好上线
✅ Custody 多签备份（如果 Securitize 出问题，怎么应对）
```

---

## 延伸思考

1. 如果 Securitize（链下 issuer）跑路，链上 token 持有者的资产能追回多少？讨论 SPV 结构的法律保护。
2. 跨链 wrapping 总有"主链锁、子链 mint"的双花风险窗口。如何用 Wormhole 的 finality 保证 + economic security 缓解？
3. DAO Treasury 把闲置 USDC 50% 换成你的 RWA token 收 4% 利息——这把 DAO 暴露在什么新的风险下？
