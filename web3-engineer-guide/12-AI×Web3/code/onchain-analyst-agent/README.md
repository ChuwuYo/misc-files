# Demo 2：LLM + viem 链上数据分析 Agent

> 配合主 README §7 阅读。
>
> 文档版本：v1.0 · 最后更新 2026-04-27

## 目标

接收自然语言查询（"过去 24 小时 vitalik.eth 转出了多少 USDC"），agent 自己解析 → 调 RPC → 返回结果。**只读，不签名，不发交易**。

## 架构

```
用户 prompt
   ↓
Claude / Anthropic SDK（with tool calling）
   ↓ 工具集（viem 实现）
[resolveENS, getERC20Transfers, getBlockByTimestamp, getTokenInfo]
   ↓
LLM 整合 → 自然语言回答
```

## 安装

```bash
npm init -y
npm i @anthropic-ai/sdk viem dotenv
```

`.env`：

```
ANTHROPIC_API_KEY=sk-ant-...
RPC_URL=https://eth.llamarpc.com
```

## 核心代码骨架（`agent.mjs`）

```js
import Anthropic from '@anthropic-ai/sdk';
import { createPublicClient, http, parseAbiItem, getAddress } from 'viem';
import { mainnet } from 'viem/chains';
import 'dotenv/config';

const client = createPublicClient({ chain: mainnet, transport: http(process.env.RPC_URL) });
const anthropic = new Anthropic();

const tools = [
  {
    name: 'resolveENS',
    description: 'Resolve an ENS name to an Ethereum address',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'getERC20Transfers',
    description: 'Get ERC20 Transfer logs for an address in a block range',
    input_schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        from: { type: 'string' },
        fromBlock: { type: 'number' },
        toBlock: { type: 'number' },
      },
      required: ['token', 'from', 'fromBlock', 'toBlock'],
    },
  },
  {
    name: 'getBlockByTimestamp',
    description: 'Approximate block number for a unix timestamp',
    input_schema: { type: 'object', properties: { unix: { type: 'number' } }, required: ['unix'] },
  },
];

async function executeTool(name, input) {
  if (name === 'resolveENS') {
    const addr = await client.getEnsAddress({ name: input.name });
    return { address: addr };
  }
  if (name === 'getERC20Transfers') {
    const logs = await client.getLogs({
      address: getAddress(input.token),
      event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
      args: { from: getAddress(input.from) },
      fromBlock: BigInt(input.fromBlock),
      toBlock: BigInt(input.toBlock),
    });
    return { count: logs.length, totalValue: logs.reduce((s, l) => s + l.args.value, 0n).toString() };
  }
  if (name === 'getBlockByTimestamp') {
    // 简化：用 12s/block 估算（生产应该用 binary search on blockNumber）
    const latest = await client.getBlock();
    const diff = Math.floor((Number(latest.timestamp) - input.unix) / 12);
    return { blockNumber: Number(latest.number) - diff };
  }
}

async function chat(userQuery) {
  let messages = [{ role: 'user', content: userQuery }];
  while (true) {
    const res = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      tools,
      messages,
    });
    if (res.stop_reason === 'end_turn') return res.content[0].text;
    const toolUses = res.content.filter((b) => b.type === 'tool_use');
    const results = await Promise.all(
      toolUses.map(async (tu) => ({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(await executeTool(tu.name, tu.input)),
      })),
    );
    messages.push({ role: 'assistant', content: res.content });
    messages.push({ role: 'user', content: results });
  }
}

console.log(await chat(process.argv.slice(2).join(' ')));
```

## 跑起来

```bash
node agent.mjs "过去 24 小时 vitalik.eth 转出了多少 USDC"
```

## 安全清单（重要）

- [ ] 工具集**只**包含只读 RPC，不允许任何 `walletClient.write*`；
- [ ] RPC endpoint 加速率限制（避免 LLM 死循环烧 quota）；
- [ ] 任何返回值带 block number + tx hash，便于核对；
- [ ] LLM 输出永远不要直接渲染 HTML（防 prompt injection 引发的 XSS）；
- [ ] **如要扩展为可发交易**：引入 ERC-4337 / ERC-7521，让 agent 生成 intent，由用户/钱包终签——见模块 10。

## 进一步学习

- 模块 10 §账户抽象：理解 agent 不持私钥的正确姿势；
- 模块 11 §RPC 与索引：理解为什么大查询应当走 The Graph / subgraph 而非 raw RPC。
