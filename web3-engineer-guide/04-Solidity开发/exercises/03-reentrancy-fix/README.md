# 练习 03：修复重入并用不变量证明

## 漏洞合约（请放进 `src/VulnerableBank.sol`）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract VulnerableBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    /// @dev 经典重入：先打钱再清账
    function withdraw() external {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "no balance");
        (bool ok,) = msg.sender.call{value: bal}("");
        require(ok, "send failed");
        balances[msg.sender] = 0;
    }
}
```

## 任务

1. 写一个攻击合约 `Attacker`，演示在 receive 中递归调用 `withdraw` 把整个 bank 抽干，并写测试 `test_attack_drainsBank` 复现
2. 给出三种修复方案：
   - **CEI 模式**（推荐）：先 `balances[msg.sender] = 0` 再外部调用
   - **OpenZeppelin `ReentrancyGuard`**：加 `nonReentrant` modifier
   - **OpenZeppelin v5 `ReentrancyGuardTransient`**（Cancun+）：使用 transient storage 锁，每笔交易自动清零，gas 比传统版本省 ~ 5000
3. 选择 CEI 修复版（命名 `SafeBank`），并用「不变量测试」证明：
   - `invariant_bankSolvent()`：`address(bank).balance >= sum(balances)` 永远成立
   - 在 fuzzer 调用序列中包含一个对 `SafeBank.withdraw` 发起重入的 `Handler`
4. 提交 `forge coverage` 截图与 `forge test --gas-report` 输出，比较三种修复方案的 gas

## 关键知识点

- 重入的本质是「外部调用之后状态没更新就 gate 检查」
- CEI = Checks → Effects → Interactions
- Transient storage（EIP-1153, Cancun）让 ReentrancyGuard 的成本从 ~5k gas/调用降到 ~200，OZ v5.2+ 提供 `ReentrancyGuardTransient`
- 不变量测试比单元测试更适合证明此类「不可能违反」属性
