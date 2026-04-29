# 习题 01：部署一个完整 OZ Governor DAO

## 题目

使用 `code/governor-foundry/` 模板，在本地 Anvil（或 Sepolia）部署一个完整的 DAO，包括：

1. 部署 ERC20Votes 治理代币、TimelockController、Governor、Treasury。
2. 把部署者代币 50% 转给 Alice、30% 转给 Bob、剩 20% 留 Treasury。
3. Alice 和 Bob 自委托代币。
4. Alice 提交一个"Treasury 转 1000 token 给某地址" 的提案。
5. 完整投票 → queue → execute。
6. 验证最终接收方拿到代币。

并回答：
- (a) 如果忘记 `delegate(self)`，会发生什么？
- (b) 如果 deployer 没有 renounce timelock admin，存在什么后门？

---

## 提示

- 起 anvil：`anvil`
- 部署：`forge script script/DeployDAO.s.sol --fork-url http://localhost:8545 --broadcast --private-key 0xac0974...`
- 用 `cast call` / `cast send` 操作合约。
- 关键时间推进可用 `cast rpc anvil_mine 7200`（推 7200 块）和 `cast rpc evm_increaseTime 86400`。

---

## 完整解答

### 1. 启动 Anvil
```bash
anvil --block-time 1
```
保留终端开着。

### 2. 部署
```bash
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
forge script code/governor-foundry/script/DeployDAO.s.sol \
    --rpc-url http://localhost:8545 \
    --broadcast \
    --private-key $PRIVATE_KEY
```
记下输出的 4 个合约地址（Token / Timelock / Governor / Treasury）。

### 3. 转代币 + 委托

```bash
TOKEN=0x...  # 替换为实际地址
ALICE=0x70997970C51812dc3A010C7d01b50e0d17dc79C8  # anvil account #1
BOB=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC    # anvil account #2

# Deployer 转 5000 万给 Alice
cast send $TOKEN "transfer(address,uint256)" $ALICE 50000000000000000000000000 --private-key $PRIVATE_KEY
# 转 3000 万给 Bob
cast send $TOKEN "transfer(address,uint256)" $BOB   30000000000000000000000000 --private-key $PRIVATE_KEY

# Alice 委托
ALICE_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
cast send $TOKEN "delegate(address)" $ALICE --private-key $ALICE_PK

# Bob 委托
BOB_PK=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
cast send $TOKEN "delegate(address)" $BOB --private-key $BOB_PK

# 推一个块让 checkpoint 写入
cast rpc anvil_mine 1
```

### 4. 提交提案

```bash
GOVERNOR=0x...
TREASURY=0x...
RECIPIENT=0x90F79bf6EB2c4f870365E785982E1f101E93b906  # anvil account #3

# 构造 calldata：treasury.transferToken(token, recipient, 1000e18)
CALLDATA=$(cast calldata "transferToken(address,address,uint256)" $TOKEN $RECIPIENT 1000000000000000000000)

# Alice 提案
cast send $GOVERNOR "propose(address[],uint256[],bytes[],string)" \
    "[$TREASURY]" "[0]" "[$CALLDATA]" "Grant 1000 MYD" \
    --private-key $ALICE_PK
```
观察 emit 的 ProposalCreated 事件，记下 proposalId。

### 5. 推进 votingDelay + 投票

```bash
cast rpc anvil_mine 7300  # 推过 votingDelay (7200)

cast send $GOVERNOR "castVote(uint256,uint8)" <proposalId> 1 --private-key $ALICE_PK
cast send $GOVERNOR "castVote(uint256,uint8)" <proposalId> 1 --private-key $BOB_PK
```

### 6. 推进 votingPeriod + queue

```bash
cast rpc anvil_mine 50500  # 推过 votingPeriod (50400)

DESC_HASH=$(cast keccak "Grant 1000 MYD")
cast send $GOVERNOR "queue(address[],uint256[],bytes[],bytes32)" \
    "[$TREASURY]" "[0]" "[$CALLDATA]" $DESC_HASH \
    --private-key $ALICE_PK
```

### 7. 推进 timelock minDelay + execute

```bash
cast rpc evm_increaseTime 172801   # +2 days + 1
cast rpc anvil_mine 1

cast send $GOVERNOR "execute(address[],uint256[],bytes[],bytes32)" \
    "[$TREASURY]" "[0]" "[$CALLDATA]" $DESC_HASH \
    --private-key $ALICE_PK
```

### 8. 验证

```bash
cast call $TOKEN "balanceOf(address)" $RECIPIENT
# 应返回 1000 × 10^18
```

### 答 (a) 忘记 delegate(self)

`getVotes(account)` 默认返回 0。即便 account 持有代币，`castVote` 时投票权重是 0，**投票不影响结果**。
更严重：如果 propose 后才 delegate，proposalSnapshot 时余额仍是 0，**整个提案没人有投票权 → quorum 永远达不到**。

→ Forum / Discord 见过无数这个 bug 的求助帖。

### 答 (b) 没 renounce timelock admin

Timelock 的 DEFAULT_ADMIN_ROLE 持有者可以：
- `grantRole` 任意角色给任意地址（包括 PROPOSER / EXECUTOR）。
- 即 admin 可以**绕过整个 governance**，自己 schedule + execute 任何调用。

→ 这等于"DAO 表面民主、实际中心化"。所有正经 DAO 部署后第一件事就是 deployer renounce admin。

---

## 延伸思考

1. 如果 DEPLOYER 故意"忘记" renounce admin，外部投资者怎么验证？给出一个链上检查脚本。
2. 你能 propose 一个修改 votingDelay 的提案吗？如何构造 calldata（hint：调用 `governor.setVotingDelay`）？
