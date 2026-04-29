# 习题 02：Beanstalk 攻击复盘 + 防御层

## 题目

回顾 2022 年 4 月 Beanstalk Governance Attack（损失 $182M）的攻击流程：

1. 闪电贷 10 亿美元（DAI / USDC / USDT）。
2. 兑换为 BEAN+3CRV LP token。
3. 把 LP 存入 Beanstalk Silo，瞬间获得 Stalk + Seeds（投票权）。
4. 调用 `emergencyCommit` 一次性投票通过 + 执行 BIP-18，把整个国库 drain 到攻击者地址。
5. 拆 LP，还闪电贷，全程 1 个区块。

**任务**：

1. 列出至少 5 个**独立的**设计错误。
2. 为每个错误给出**工程修复方案**。
3. 写一个 Foundry 测试，演示修复后同种攻击在 OZ Governor + Timelock 上不可行。

---

## 完整解答

### 5 个设计错误

| # | 错误 | 修复 |
|---|------|------|
| 1 | 投票权 = 当前余额（无 snapshot） | ERC20Votes + getPastVotes(snapshotBlock) |
| 2 | emergencyCommit 让 propose / vote / execute 同区块 | 必须经过 votingDelay → votingPeriod → timelock 三段时间 |
| 3 | 投票权 = LP token 余额（可闪电贷 mint） | 治理代币与 LP token 解耦 |
| 4 | quorum 太低或没有 | quorum ≥ 4% 流通量 |
| 5 | 没有 emergency pauser | 5/9 multisig 或 Hats Pauser，可立刻暂停 governance |

### 数学论证：修复后为何攻击不可行

OZ Governor + Timelock 总耗时：
```
votingDelay (1 day) + votingPeriod (7 days) + timelock minDelay (2 days) = 10 days
```

闪电贷必须**同区块还清**。攻击者无法在闪电贷期间持有代币 10 天。

→ 即便攻击者真有 $10 亿现金（不是闪电贷），购买 50% 流通治理代币 → 提案 → 等 10 天投票/执行——市场价格波动 + 社区警觉 + emergency pauser 介入，都会阻止。

### Foundry 测试代码

参考 `code/governor-foundry/test/Governor.t.sol` 的 `test_FlashLoanCannotPassProposal`：

```solidity
function test_FlashLoanAttackInOneBlock_Fails() public {
    address attacker = makeAddr("attacker");
    // 模拟闪电贷收到 60M 代币（占总量 60%）
    token.transfer(attacker, 60_000_000e18);
    vm.prank(attacker);
    token.delegate(attacker);

    bytes memory data = abi.encodeWithSelector(
        Treasury.transferToken.selector,
        address(token), attacker, 10_000_000e18
    );
    address[] memory targets = new address[](1);
    targets[0] = address(treasury);
    uint256[] memory values = new uint256[](1);
    values[0] = 0;
    bytes[] memory calldatas = new bytes[](1);
    calldatas[0] = data;
    string memory desc = "drain";

    vm.prank(attacker);
    uint256 pid = governor.propose(targets, values, calldatas, desc);

    // 同块投票：被 votingDelay 阻止
    vm.expectRevert();
    vm.prank(attacker);
    governor.castVote(pid, 1);
}
```

完整版同时验证：
- 即便等到 active 状态投票通过，闪电贷还款时间已过期 → 攻击经济上不可行。

### 现实修复

Beanstalk 团队 2022 年 8 月恢复后实际做法：
- 移除整个 GovernanceFacet 的链上即时投票。
- 改用 Snapshot 链下投票 + 多签执行（暂时）。
- 后期重构为 "Sunrise Governance" 加入快照机制。

---

## 延伸思考

1. 如果 Beanstalk 当时已用 OZ Governor + Timelock，但 timelock minDelay = 0，攻击仍然能成功吗？
2. ERC20Votes 的 checkpoint 在 transfer 时写入，如果攻击者反复在闪电贷里 transfer 制造 100 万 checkpoint，会 gas 攻击吗？
3. 攻击者 BIP-19 转 25 万到乌克兰援助地址，是否影响法律追责？
