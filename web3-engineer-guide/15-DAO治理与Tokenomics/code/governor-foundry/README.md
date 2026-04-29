# Governor Foundry 项目

OZ Governor + ERC20Votes + TimelockController + Treasury 完整 DAO，可运行测试。

## 安装

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2
forge install foundry-rs/forge-std
```

`remappings.txt`:
```
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
```

## 运行测试

```bash
forge test -vvv
```

预期输出（关键测试）：
- `test_FullCycle`：完整生命周期通过。
- `test_QuorumNotReachedDefeats`：未达 quorum 自动 Defeated。
- `test_FlashLoanCannotPassProposal`：闪电贷攻击在 votingDelay 处被阻止。

## 部署到 Sepolia

```bash
export PRIVATE_KEY=0x...
export SEPOLIA_RPC_URL=https://...
forge script script/DeployDAO.s.sol --rpc-url sepolia --broadcast --verify
```

## 关键参数

| 参数 | 值 | 含义 |
|------|---|------|
| votingDelay | 7200 块 (~1 day) | 防 propose-同块买票 |
| votingPeriod | 50400 块 (~7 days) | 投票窗口 |
| proposalThreshold | 0 | 生产应设 0.5-1% 流通量 |
| quorumNumerator | 4 | 法定人数 4% |
| timelock minDelay | 2 days | execute 前强制延迟 |

## 阅读顺序

1. `src/MyGovToken.sol` — ERC20Votes 治理代币
2. `src/MyGovernor.sol` — Governor 主合约
3. `src/Treasury.sol` — 国库（owner = Timelock）
4. `script/DeployDAO.s.sol` — 部署脚本
5. `test/Governor.t.sol` — 完整生命周期测试
