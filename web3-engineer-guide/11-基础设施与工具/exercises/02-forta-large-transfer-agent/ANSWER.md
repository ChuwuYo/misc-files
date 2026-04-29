# 习题 2 参考答案: Forta agent ERC20 大额转账

## 设计要点

1. **基于 filterLog**: 直接用 ABI 字符串 `event Transfer(address indexed from, address indexed to, uint256 value)` 调用 `txEvent.filterLog`, 自动按合约地址过滤; 比手动 keccak topic 解析快.
2. **decimals 差异**: USDC/USDT 是 6 位, DAI 是 18 位, 不能用同一个 threshold; 用 `Map<address, meta>` 存储.
3. **bigint 而非 number**: ERC20 amount 可能超过 2^53, JS Number 会精度丢失.
4. **labels**: 用 Forta labels 把 from/to 打上 `high-value-sender` 标签, 下游可以做制裁名单交叉, 实现风控级联.
5. **多链复用**: 同一份 agent 通过 chainIds 配置 [1, 8453, 42161, 10] 部署到 mainnet/Base/Arbitrum/Optimism, 但 token 地址表要按链拆分 (本例只演示 mainnet).
6. **gas 优化**: 在 handleTransaction 顶部 `Object.keys(WATCHED_TOKENS).length === 0 return` 提前退出; 实际 Forta 收费按 calls × duration.

## 部署

```bash
npm i
npm run build
forta-agent push                # 推到 IPFS + 链上注册 (需要 FORT 抵押)
forta-agent enable --chain 1
```

## 与 Tenderly Alerts / Defender Sentinel 对比

| 维度 | Forta | Tenderly Alert | Defender Sentinel |
|---|---|---|---|
| 部署 | 链上注册, 抵押 FORT | SaaS, 控制台配置 | SaaS, 即将关停 (2026-07) |
| 自定义逻辑 | 完整 TS/Python | YAML 条件 | JS Autotask |
| 多链 | 50+ EVM | 30+ | EVM 主流 |
| 成本 | 按 query 收 FORT | $400/月起 (Pro) | 暂时免费 |
| 适合场景 | 全网监控、社区 bot | 自家协议、debug | 自家协议、紧急响应 (即将迁移) |
