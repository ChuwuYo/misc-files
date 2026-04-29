# Demo 4：ORA opML SDK 调用链上推理

> 配合主 README §9 阅读。
>
> 文档版本：v1.0 · 最后更新 2026-04-27

## 目标

在 Sepolia 测试网调用 ORA AI Oracle (OAO)，让链下模型跑推理，结果在挑战期后回调到你的合约。

## 前置依赖

```bash
forge install ora-io/OAO  # 如有
```

或直接克隆 [ora-io/OAO](https://github.com/ora-io/OAO)（检索 2026-04）参考最新接口。

## 合约骨架（`src/MyConsumer.sol`）

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IAIOracle {
    function requestCallback(
        uint256 modelId,
        bytes calldata input,
        address callbackContract,
        uint64 gasLimit,
        bytes calldata callbackData
    ) external payable returns (uint256 requestId);

    function estimateFee(uint256 modelId, uint64 gasLimit) external view returns (uint256);
}

abstract contract AIOracleCallbackReceiver {
    IAIOracle public immutable aiOracle;

    constructor(IAIOracle oracle) { aiOracle = oracle; }

    modifier onlyAIOracleCallback() {
        require(msg.sender == address(aiOracle), "only AIOracle");
        _;
    }

    function aiOracleCallback(
        uint256 requestId,
        bytes calldata output,
        bytes calldata callbackData
    ) external virtual;
}

contract MyConsumer is AIOracleCallbackReceiver {
    event Asked(uint256 indexed requestId, address user, string prompt);
    event Answered(uint256 indexed requestId, string output);

    mapping(uint256 => address) public requesterOf;
    mapping(uint256 => string) public answerOf;

    constructor(IAIOracle oracle) AIOracleCallbackReceiver(oracle) {}

    /// @notice 用 OpenLM Llama-2-7B（modelId 由 ORA 文档给出）
    function ask(uint256 modelId, string calldata prompt) external payable {
        bytes memory input = bytes(prompt);
        uint64 gasLimit = 1_000_000;
        uint256 fee = aiOracle.estimateFee(modelId, gasLimit);
        require(msg.value >= fee, "insufficient fee");
        uint256 reqId = aiOracle.requestCallback{value: fee}(
            modelId, input, address(this), gasLimit, ""
        );
        requesterOf[reqId] = msg.sender;
        emit Asked(reqId, msg.sender, prompt);
    }

    function aiOracleCallback(
        uint256 requestId,
        bytes calldata output,
        bytes calldata /* callbackData */
    ) external override onlyAIOracleCallback {
        string memory answer = string(output);
        answerOf[requestId] = answer;
        emit Answered(requestId, answer);
    }
}
```

## 部署 + 调用脚本（`script/Deploy.s.sol`）

```solidity
// 用 forge script 部署，OAO 地址查 ORA docs
// https://docs.ora.io/
```

## 时序图（人话版）

```
用户 → MyConsumer.ask() (带 fee)
       ↓
   AIOracle.requestCallback() 触发链下计算
       ↓
   ORA 网络跑模型推理
       ↓
   把 (output, commitment) 写链
       ↓
   挑战期 ~10 分钟（验证者可挑战）
       ↓
   挑战期满 → AIOracle 回调 MyConsumer.aiOracleCallback()
       ↓
   MyConsumer 收到结果，可触发后续业务（mint NFT、解锁存款等）
```

## 注意事项

- ORA 文档（[https://docs.ora.io/](https://docs.ora.io/)，检索 2026-04）会列出当前 Sepolia/Mainnet 上可用 modelId、fee、回调 gas 推荐；
- 挑战期约 10 分钟，业务设计要能容忍这个 latency；
- 大输入（>2KB）建议先 IPFS 存证，链上只放 hash；
- 结果回调成功后，记得检查 `requesterOf[requestId]` 是不是合法发起者，避免别人替换 callback 数据。

## 何时该选 opML 而非 zkML

- 高频小额推理（每次 $1-100 价值）；
- 用户能等 10 分钟挑战期；
- 不需要隐藏模型权重；
- 可接受"乐观信任 + 可挑战"。

否则回到主 README §3.0 的决策树。
