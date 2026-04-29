# 练习 2：实现一个事件驱动的 on-chain LLM agent

> 主 README §10.2
>
> 目的：让你**亲手**遇到 agent + LLM + 链上交互的所有坑。

## 任务

1. 在 Sepolia 部署一个简单合约：
   ```solidity
   contract QA {
       event Question(uint256 indexed id, address indexed asker, string content);
       event Answer(uint256 indexed id, string content);
       uint256 public nextId;
       mapping(uint256 => string) public answers;
       function ask(string calldata q) external returns (uint256 id) {
           id = nextId++;
           emit Question(id, msg.sender, q);
       }
       function submitAnswer(uint256 id, string calldata a) external {
           // 加签名校验：只允许 oracle EOA
           answers[id] = a;
           emit Answer(id, a);
       }
   }
   ```
2. 写一个 Node 服务：
   - 监听 `Question` 事件；
   - 调用 Anthropic / OpenAI API 生成答案；
   - 用 oracle EOA 私钥签名 + 发送 `submitAnswer`。
3. 添加三个安全约束：
   - 签名校验（只允许特定 oracle 提交答案）；
   - rate limit（每个 asker 每分钟最多 N 个问题）；
   - 最大问题长度（防止 LLM 烧 token）。

## 工程提示

- 用 `viem` 监听事件，记得处理 reorg：等 6+ 个 confirmation 再调 LLM；
- 用环境变量 + KMS 管 oracle 私钥，不要硬编码；
- LLM 调用要 timeout + retry；
- 把 `Question.content` 给 LLM **之前**做长度截断，并 escape 任何疑似指令的 token（这是初级的 prompt injection 防御）。

## 进阶（必做加分）

把你的 agent 改造成"**不持私钥发 tx**"模式：

- 用 ERC-4337 智能账户，用户为 agent 设置一个 session key；
- 或者用 ERC-7521 intent，agent 只生成 intent，由用户签名后 solver 执行；
- 这样即使 agent 被 prompt injection 接管，攻击者也不能直接把钱转走（详见主 README §4.1 aixbt 案例）。

## 提交格式

仓库里包含：

- `src/QA.sol`（Solidity 合约）
- `agent/index.mjs`（Node agent）
- `agent/.env.example`
- `README.md`：说明部署地址、跑法、你做的安全权衡
