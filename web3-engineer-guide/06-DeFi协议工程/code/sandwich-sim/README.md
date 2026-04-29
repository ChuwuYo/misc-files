# Sandwich Simulator（教学，仅用于研究）

用 viem + Foundry fork 模拟一笔三明治攻击。**严禁用于主网生产**——多数辖区有合规风险。

## 学习目标

- 用 viem 监听 ws mempool
- Foundry fork 主网做"假设性 tx 模拟"
- 计算 sandwich 利润 vs gas 成本
- 理解 MEV searcher 的工作流

## 运行

```bash
pnpm install   # 或 npm install
cp .env.example .env  # 填入 MAINNET_WS_RPC_URL、ANVIL_RPC_URL
# 终端 1：启动 anvil fork
anvil --fork-url $MAINNET_RPC_URL --auto-impersonate
# 终端 2：跑 stub（当前仓库内是占位演示，真实 mempool 监听留作练习）
pnpm simulate
# 或：pnpm tsx scripts/simulate-sandwich.ts
```

> 当前 `scripts/simulate-sandwich.ts` 是**最小占位 stub**，演示如何连 anvil fork 并打印一段
> "假设性"利润计算。完整的 mempool 监听 / decode swap / front+back run 模拟，留作练习。

## 核心逻辑

`scripts/simulate-sandwich.ts`（伪代码骨架）：

```ts
import { createPublicClient, createWalletClient, http, parseEther, webSocket, decodeFunctionData } from 'viem';
import { mainnet } from 'viem/chains';

const ws = createPublicClient({ chain: mainnet, transport: webSocket(process.env.MAINNET_WS_RPC_URL!) });
const anvil = createWalletClient({ chain: mainnet, transport: http(process.env.ANVIL_RPC_URL!) });

// 1. 订阅 mempool pending tx（要 archive ws，公共 endpoint 大多没此权限）
ws.watchPendingTransactions({
  onTransactions: async (hashes) => {
    for (const hash of hashes) {
      const tx = await ws.getTransaction({ hash });
      if (!isUniV2OrV3Swap(tx)) continue;
      const swap = decodeSwap(tx);
      if (swap.amountIn < parseEther('10')) continue;  // 只关心 >10 ETH 大单

      // 2. 在 fork 上模拟 victim swap，得到滑点
      const beforeState = await anvilSnapshot();
      const victimResult = await anvilSendTx(tx);

      // 3. 计算 sandwich：假设我们 front-run X% 资金、back-run 同样
      const front = swap.amountIn * 0.5n;
      const sandwichProfit = await simulateSandwich(swap, front);

      // 4. 减去 gas、builder 出价
      const netProfit = sandwichProfit - estimateGasCost() - estimatedBuilderTip;

      console.log({ tx: hash, victimAmount: swap.amountIn, netProfit });

      // 5. 教学版：只打印，不真发 bundle
      await anvilRevert(beforeState);
    }
  }
});
```

## 安全提示

- **不要在主网真的发 bundle**——sandwich 在司法上仍是灰色甚至违法（CFTC 已经因 Eisenberg 案做出判例）。
- 教学版仅在 **本地 anvil fork** 上模拟，不连真实 Flashbots relay。
- 学完之后，请把这套技术用在防御端：构建你自己的 mempool 监控，给受害者做实时 alert。
