# 习题 04：设计一个新协议代币模型

## 题目

你为一个新的 DEX 设计代币模型。条件：

- 协议预计 6 个月后上线，希望立即有流动性。
- 有 4 名核心团队 + 12 名早期员工。
- 已经融了 800 万美元（3 个机构投资人）。
- 目标用户：DeFi 老用户 + 一部分新人。
- 想抗 SEC（不被认定为 securities）+ 想合规进欧盟（MiCA 友好）。

请回答：
1. 总量？
2. 7-8 个分类的占比和 vesting 计划？
3. 选 ve / ve(3,3) / sToken / 简单 staking 哪种激励模型？理由？
4. TGE 后哪些动作最关键的前 90 天？

---

## 解答骨架（参考答案，开放）

### 1. 总量

总量 1,000,000,000 TOKEN（10 亿，整数好记）。

### 2. 分配

| 类别 | 占比 | 数量（亿）| Vesting | 理由 |
|------|------|---------|---------|------|
| **DAO Treasury** | 35% | 3.5 | 即可使用，但治理批准才能动 | 长期 grant + emissions |
| **流动性挖矿 / 用户激励** | 22% | 2.2 | 4 年逐步发放（前 6 月放 30%，后 3.5 年逐渐降） | 启动流动性 + 长期使用 |
| **Airdrop**（早期用户 + 测试网用户） | 8% | 0.8 | TGE 立即解锁 50%，剩 50% 锁 6 月 + 6 月 linear | 反女巫 + 反砸盘 |
| **团队 + 员工** | 15% | 1.5 | 12 月 cliff + 36 月 linear | 长期对齐，1 年最低承诺 |
| **早期投资人** | 12% | 1.2 | 12 月 cliff + 24 月 linear | 给 VC 但不能"砸盘" |
| **流动性 + 做市商** | 5% | 0.5 | TGE 立即可用 | 上线即流动性 |
| **生态合作 + Bug Bounty** | 3% | 0.3 | 由 DAO 治理批准 | 长尾 |

**关键设计**：
- 团队 + 投资人合计 = 27%（< 30%）。
- 即便最坏情况下（团队解锁后全卖），市场存在缓冲（社区持有 73%）。
- DAO Treasury 35% 给治理充足的长期资金来源。
- Airdrop 仅 8%，分散到广泛用户，避免"巨鲸领空投"。

### 3. 激励模型

选 **ve(3,3)**（类 Velodrome / Aerodrome）。

理由：
1. **真实价值绑定**：100% swap fee 给 voter，避免"治理代币无现金流" 问题。
2. **已有大规模成功验证**：Aerodrome 在 Base 占 60% DEX 量。
3. **vote 经济激励 LP**：voter 决定 emissions 给哪些 pool → bribe market 自然形成。

不选其他原因：
- 纯 ve（Curve）：50% fee，剩 50% 给 reserve、不直接 reward voters，激励不够强。
- sToken (Pendle 风格)：cooldown 周期 vs 真锁仓，对 mechanism 设计较新，先验风险高。
- 简单 staking：缺乏长期对齐，容易"挖、提、卖" 死亡螺旋。

**改进**：参考 Aerodrome，提供官方"流动性 wrapper" 让用户可以 soft-exit（避免 Curve War 期间被 Convex 完全主导）。

### 4. TGE 前 90 天关键动作

```
T-30 天：
  - 完成多签 setup（5/9）
  - 法律意见书（Howey + MiCA）
  - 审计完成（至少 2 家：OpenZeppelin、Trail of Bits 之类）

TGE Day 0：
  - 部署 token + Governor + Timelock
  - 启动 airdrop claim（限期 90 天）
  - 上线流动性挖矿（前 6 月发 30% 用户激励）
  - CEX listing（至少 2-3 家中型，避免一上就被砸）

T+7 天：
  - 第一个 governance 提案：参数调整 / pool 上线
  - 启动 Snapshot space + 论坛

T+30 天：
  - 第一次 ve(3,3) emissions epoch 结束
  - 开始接受 bribe（Hidden Hand / Votium 集成）
  - 公布 Treasury 详细透明数据

T+60 天：
  - 团队 vesting 仍未启动（cliff 12 月），市场无团队抛压
  - 评估第一次大型 grant（用 DAO Treasury）

T+90 天：
  - Airdrop claim 截止
  - 评估流动性挖矿调参
  - 撤销部署者所有特殊权限（pauser 之外）
```

### 5. 红旗自查

```
✅ 团队 + 投资人 < 30%
✅ TGE 流通比 ≥ 25%（避免低 float / 高 FDV 陷阱）
✅ Cliff ≥ 12 月
✅ DAO Treasury ≥ 30%
✅ 总 vesting ≥ 4 年
✅ MiCA：避免算法稳定币、可争议的"投资合约"特征
✅ Howey：fee switch 推迟到协议完全去中心化后
✅ 部署者放弃所有 owner 特权（除 pauser 紧急）
```

---

## 延伸思考

1. 如果你的 8% airdrop 落入 50000 个地址，按 Sybil-passport 过滤后只有 30000 真实用户合规，剩余 20000 的代币该怎么处理？
2. DAO Treasury 35% 是否过高？激进派会说 50%，保守派会说 20%。论证为什么 30-35% 是 sweet spot。
3. 团队 vesting 12 月 cliff，如果团队成员 6 月离职，未 vest 部分应该怎么处理？设计一份合约级 revocable vesting。
