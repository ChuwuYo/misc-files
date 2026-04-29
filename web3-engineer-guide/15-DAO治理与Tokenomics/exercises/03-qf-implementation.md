# 习题 03：QF 实现与 Sybil 测试

## 题目

匹配池 = 10000 美元。三个项目：

- **A**：4 个捐款人各 100 美元。
- **B**：100 个捐款人各 4 美元。
- **C**：1 个捐款人 400 美元。

### Part 1
1. 计算各项目 QF score。
2. 计算各拿到匹配池多少？

### Part 2
A 的 4 个捐款实际是同一攻击者控制的女巫地址。Gitcoin Passport 给 trust = 0.1。
3. 用 `qfScoreWithSybilDiscount` 重新计算 A 的 score 和分配。

### Part 3
4. 如果你是 sponsor，"Sybil discount (trust)" vs "pairwise-bounded"，哪种更适合面向广泛用户的 round？

---

## 完整解答

### Part 1：基础 QF

```
A: sumOfRoots = 4·√100 = 40 → score = 1600，raw = 400
B: sumOfRoots = 100·√4 = 200 → score = 40000，raw = 400
C: sumOfRoots = √400 = 20  → score = 400，raw = 400

totalScore = 1600 + 40000 + 400 = 42000

A 匹配 = (1600/42000)·10000 - 400 = 380.95 - 400 = 0（截断）
B 匹配 = (40000/42000)·10000 - 400 = 9523.8 - 400 = 9123.8 美元
C 匹配 = (400/42000)·10000 - 400 = 95.24 - 400 = 0
```

→ B 几乎独占池子。**这正是 QF 的设计目的**：奖励"人数 + 多样化捐款"，惩罚"鲸鱼 + 集中捐款"。

### Part 2：Sybil 折扣

```
A 重算（trust = 0.1，每个捐款 = 100，effective = 100 × 0.1 = 10）：
sumOfRoots = 4·√10 ≈ 4 × 3.162 = 12.649
score ≈ 160

新 totalScore = 160 + 40000 + 400 = 40560

A 匹配 = (160/40560)·10000 - 400 = 39.45 - 400 = 0（仍然截断）
B 匹配 = (40000/40560)·10000 - 400 = 9861.9 - 400 = 9461.9 美元
C 匹配 = (400/40560)·10000 - 400 = 98.62 - 400 = 0
```

→ A 的 sybil 攻击不仅没拿到匹配池，本身已经损失了 400 美元的"假捐款"成本。攻击 ROI 显著为负。

### Part 3：trust vs pairwise

| 维度 | Sybil discount (trust) | Pairwise-bounded |
|------|----------------------|------------------|
| 数据需求 | 每个 donor 一个 trust score | 不需要 |
| 计算复杂度 | O(N) | O(N²) |
| 抗"协同攻击"（认识的人合谋） | 弱 | 强 |
| UX | 需用户先 Passport "盖戳" | 用户什么都不做 |
| 误伤新用户 | 高 | 低 |

**面向广泛新用户的 round 推荐 pairwise-bounded**——因为不需要新用户先去申请身份证。但 pairwise 在大 round（数千 donor）下计算昂贵，实务中 Gitcoin 用 **COCM** 折中。

### 实测代码

```bash
cd code/quadratic-funding
npm install
npm test
```

测试 `readme example: A=4×100 vs B=100×4` 应通过。

---

## 延伸思考

1. 如果 A 把 400 美元拆成 400 个 1 美元的 Sybil 捐款，QF score 变成多少？sybil discount 后呢？
2. QF 鼓励"人数"。这是否激励项目方"花钱请假人来捐"？计算盈亏临界。
3. RPGF（追溯式）和 QF（前瞻式）哪种更适合"开源工具" 这种类型的资助？
