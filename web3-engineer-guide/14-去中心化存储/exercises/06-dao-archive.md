# 练习 06：DAO 投票档案永久保存

## 目标

设计并实现一个完整的"DAO 投票永久档案"系统：保证 50 年后任何人能验证投票结果未被篡改。

## 场景

某 DAO 有 1000 名成员，每月一次投票。你是 protocol engineer，需要：

- 每次投票后自动产出快照（含提案、投票项、投票者地址、最终结果、链上区块号）
- 上传到去中心化存储（Arweave 永久 + Filecoin 双保险）
- 链上记录 hash 让 50 年后可验证
- 提供 viewer 工具让任何人能拉档案、验证、可视化

## 任务

### 任务 6.1（合约层）

写 `VoteArchive.sol`：

```solidity
struct Snapshot {
    uint256 proposalId;
    string arweaveTxId;     // ar:// 永久指针
    string ipfsCid;          // ipfs:// 热缓存指针
    bytes32 contentHash;     // 内容的 sha256 hash
    uint256 finalizedAt;     // 区块时间
}

mapping(uint256 => Snapshot) public snapshots;
event SnapshotFinalized(uint256 indexed proposalId, bytes32 contentHash, string arweaveTxId);
```

### 任务 6.2（上传层）

写 Node.js 服务：
1. 监听 DAO 主合约的 `ProposalFinalized` 事件
2. 拉取该投票全部数据（投票事件、最终结果）
3. 序列化为 canonical JSON（确保可重现 hash）
4. 上传到 Arweave（via Irys）+ Filecoin（via Lighthouse）
5. 计算 contentHash = sha256(canonical JSON)
6. 调 `VoteArchive.archive(proposalId, arweaveTxId, ipfsCid, contentHash)`

### 任务 6.3（验证 viewer）

写一个 React / 命令行工具：
- 输入 proposalId
- 从合约读 Snapshot
- 从 Arweave / IPFS 拉 JSON（任选其一）
- 算 sha256 → 比对合约的 contentHash
- 显示投票结果可视化

### 任务 6.4（弹性测试）

模拟以下场景，验证 viewer 仍可工作：
- IPFS 全部失效
- Arweave 网关延迟很高
- 某个 IPFS pinning 服务关停（推荐使用 6 章学过的多平台冗余）

## 提交格式

`solution-06/`:
- `contracts/` Solidity + Foundry test
- `archiver/` 服务端 Node.js
- `viewer/` 客户端
- `e2e-test.md` 端到端测试报告
- `architecture.md` 架构图（mermaid）

## 评分

- canonical JSON 是否真可重现 hash（高频出错点：字段顺序）
- 双平台上传是否真同步（一个失败不影响另一个）
- viewer 在网络故障下是否优雅降级
- 50 年后的可验证性论证是否充分（包括：合约不会被改、Arweave 经济模型论证、备份策略）

## 思考题

如果某天合约升级了（新 proxy 实现），你怎么保证 50 年后的人能找到"老合约的所有 Snapshot"？

提示：一个稳健的方案是把 proxy admin 设为不可变 + 把每次升级的新地址也写进 Arweave，形成"链上 + 永久存储"的双重历史归档。
