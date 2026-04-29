# 练习 05：多平台冗余 + 链上 hash 自证

## 目标

实现完整的"链下数据 + 链上 hash 自证"系统。

## 任务

### 任务 5.1

写一个 Solidity 合约 `DataRegistry`：

```solidity
contract DataRegistry {
    mapping(string => bytes32) public officialCidHash;
    event OfficialDataPublished(string indexed label, string cid, bytes32 cidHash);

    function publish(string calldata label, string calldata cid) external onlyOwner;
    function verify(string calldata label, string calldata claimedCid) external view returns (bool);
}
```

要求：
- 只有 owner 能 publish
- 任何人都能 verify
- emit event 留下不可变历史

### 任务 5.2

写一个 Foundry 测试，覆盖：
- publish + verify happy path
- 非 owner 不能 publish
- 同一 label 重复 publish 是否允许（自定义策略）

### 任务 5.3

写一个 Node.js 客户端：
1. 上传一个文件到 Pinata + Lighthouse + Filebase（任选 2 家以上）
2. 调 contract.publish('my-data-v1', cid)
3. 在另一台机器，重新拉文件验证 hash 与链上一致

### 任务 5.4（选做）

模拟 Pinata 关停：
- 该工具要能自动检测某 CID 不可达
- 触发"迁移流程"：从其他平台读 → 重新上传到新 pinning 服务 → 链上 emit `MigratedTo` event 留痕

## 提交格式

`solution-05/`:
- `DataRegistry.sol` + Foundry test
- `client.mjs`（上传 + 注册 + 验证）
- `migrate.mjs`（模拟迁移）
- `README.md`

## 评分

- 合约权限正确性
- 客户端能从链上读 hash 后真校验链下数据
- 迁移流程是否健壮（部分平台失败时仍能保数据）
