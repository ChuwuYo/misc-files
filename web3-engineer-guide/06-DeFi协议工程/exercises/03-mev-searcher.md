# 练习 03：最简 MEV searcher（跨 DEX 套利）

## 题目

实现一个最简 searcher：监听公共 mempool 的 pending tx，发现一笔大额 V2 swap → 计算它会让池子价格偏离 V3 池价格 → 在套利盈利空间存在时构造 Flashbots bundle 发送。

## 要求

1. 用 viem 监听 ws mempool。
2. 用 Foundry fork 在本地模拟 victim tx 后的池子状态。
3. 计算 V2 vs V3 的价差，判断是否盈利。
4. 构造 bundle（不必真发主网 relay，模拟即可）。
5. 30 分钟运行后输出统计：扫到几笔大单、几笔可套利、毛利、估算 gas 成本、净利。

## 难点

- 公共 ws mempool 可能拿不到全部 pending（很多 tx 走私有 mempool）。开发阶段可以重放历史区块。
- victim tx 的 calldata 解码（V2 router 多种入口）。
- gas 估算：包含 front-run + back-run 两笔 + builder tip。
- 实战：你要和其它 searcher 抢 → 落块成功率可能 < 10%。

## 骨架（TypeScript + viem）

```ts
import { createPublicClient, webSocket, decodeFunctionData, parseEther } from 'viem';
import { mainnet } from 'viem/chains';

const ws = createPublicClient({
  chain: mainnet,
  transport: webSocket(process.env.MAINNET_WS_RPC_URL!)
});

const stats = {
  scanned: 0,
  bigSwaps: 0,
  profitable: 0,
  totalGrossProfit: 0n,
  totalGasCost: 0n,
};

ws.watchPendingTransactions({
  onTransactions: async (hashes) => {
    for (const hash of hashes) {
      stats.scanned++;
      try {
        const tx = await ws.getTransaction({ hash });
        if (!isUniV2Router(tx.to)) continue;
        const decoded = decodeFunctionData({ abi: V2_ROUTER_ABI, data: tx.input });
        if (decoded.functionName !== 'swapExactETHForTokens' &&
            decoded.functionName !== 'swapExactTokensForTokens') continue;
        if (decoded.args[0] < parseEther('5')) continue;
        stats.bigSwaps++;

        // 1. fork 本地，模拟 victim tx 后的 V2 池子状态
        const v2State = await simulateOnAnvil(tx);
        // 2. 拿 V3 池子的 sqrtPriceX96 算价格
        const v3Price = await getV3Price(decoded.args.path);
        // 3. 计算 V2 vs V3 价差
        const arbProfit = computeArb(v2State, v3Price);
        if (arbProfit <= 0n) continue;
        stats.profitable++;
        stats.totalGrossProfit += arbProfit;
        // 4. 估 gas
        const gasCost = await estimateBundleGas(/* ... */);
        stats.totalGasCost += gasCost;
        // 5. 教学版：只 log，不真发 bundle
        console.log({
          tx: hash,
          victimSize: decoded.args[0],
          arbProfit,
          gasCost,
          net: arbProfit - gasCost
        });
      } catch (e) { /* skip 解析错误 */ }
    }
  }
});

setTimeout(() => {
  console.log('30min stats:', stats);
  process.exit(0);
}, 30 * 60 * 1000);
```

## 进阶版

1. **加 sandwich 模式**：除了跨 DEX 套利，识别"victim swap 的滑点容忍 < 1%"的大单，构造 [front, victim, back] sandwich bundle。
2. **加清算机会**：除了 mempool 监听，定期 poll Aave V3 的 `getUserAccountData`，找 HF<1.05 的地址、Chainlink 价格 staleness 临界、提前 0.5 秒发清算 tx。
3. **加 Flashbots Protect 模拟**：实际把你的 bundle 发到 [Flashbots Sepolia relay](https://docs.flashbots.net/flashbots-auction/quick-start) 而非主网，统计落块成功率。

## 安全提示

- **不要在主网真的跑 sandwich**——多数辖区合规风险，且和 SEC vs Eisenberg 案后法律边界仍模糊。
- 跨 DEX 套利和清算 MEV 是合法的，但你会和无数高速 bot 抢——除非有 latency 优势 + 私有 orderflow，新人很难赚钱。
- **学完之后，最有价值的方向是去做防御端**：MEV-Boost 替代方案、用户侧 sandwich 防御（CowSwap、UniswapX 集成）。

## 参考实现

历史上开源的 searcher 项目（学习用）：
- [flashbots/simple-arbitrage](https://github.com/flashbots/simple-arbitrage)（V1 时代）
- [paradigmxyz/mev-rs](https://github.com/paradigmxyz/mev-rs)（Rust 框架）
