# Snapshot 投票示例

## 教学目标

- 知道 Snapshot 投票本质 = EIP-712 签名 + IPFS 存储
- 学会用 snapshot.js SDK 在脚本里投票

## 文件

- `snapshot-vote.ts` — 投票 / 提案 / 投票权查询封装

## 安装

```bash
npm install
```

## 用法（伪代码示意）

```ts
import { castVote } from "./snapshot-vote";

await castVote({
  privateKey: process.env.PRIVATE_KEY!,
  space: "uniswap",                                  // Uniswap DAO
  proposal: "0x...",                                 // proposal ID
  choice: 1,                                         // 1 = For
  reason: "Supporting the protocol fee switch",
});
```

## 注意事项

- **不要**把私钥写进代码或 commit。生产用环境变量或硬件钱包。
- 投票被 Snapshot Hub 验证签名 + 在 snapshot block 计算余额。
- 如果你在 snapshot block 之后买入代币，**这些新代币不能用于这次投票**。
