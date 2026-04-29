# Perp DEX Threat Model 模板

> 用于：永续合约 DEX 协议（funding rate, mark price, liquidation, oracle）
> 用法：替换具体协议名称，逐项填写

## 1. 资产清单

| 资产 | 描述 | 价值 |
|---|---|---|
| Insurance Fund | 兜底用 USDC | 协议核心 |
| Trader Margin | 用户保证金 | 用户全部 |
| LP Pool | 做市方流动性 | LP 全部 |
| Fee Vault | 手续费 | 营收 |

## 2. Actor Map

| Actor | 能力 | 风险 |
|---|---|---|
| Trader | open / close / add margin | 操纵自己的清算阈值、front-run 价格 |
| Liquidator (permissionless) | 清算未健康仓位 | 抢跑、合谋不清算 |
| LP | 入金 / 出金 | inflation、loss-on-funding |
| Oracle Updater | 推送 mark price | 推错 / 推迟 |
| Admin | 改参数、暂停、升级 | 私钥被盗、内鬼 |
| Flash loan caller | 一笔 tx 借走巨额资金 | 操纵 mark price 或 funding |

## 3. Trust Assumption

- T1: Oracle 至少 1 个源诚实
- T2: Multisig 至少 N-of-M 中的 (M-N+1) 诚实
- T3: 区块链不发生 reorg > 12 块
- T4: Liquidator 集群至少有 1 个在线

## 4. Invariants

| ID | Invariant |
|---|---|
| I1 | sum(margin) + insuranceFund >= sum(unrealizedPnL+) |
| I2 | for any user：margin > maintenanceMargin OR position 已被清算 |
| I3 | totalLongOI == totalShortOI（合约本质，不允许净敞口） |
| I4 | funding 累积单调，不会减小已结算的 funding |
| I5 | 任何 admin 操作都通过 timelock |

## 5. Attack Tree

```
Goal: Drain Perp DEX
├── A. 操纵 mark price
│   ├── A1. Oracle 操纵（spot / TWAP）
│   ├── A2. 闪电贷 + 无熔断
│   └── A3. 多源 median 中过半数被攻
├── B. 操纵 funding rate
│   ├── B1. 在 funding 结算前刷大单
│   └── B2. funding rate cap 缺失
├── C. 清算逻辑
│   ├── C1. 自己清算自己拿 bonus（self-liquidate）
│   ├── C2. liquidation bonus > collateral
│   └── C3. partial liquidation 计算误差
├── D. 治理 / Admin
│   ├── D1. multisig 私钥被盗
│   ├── D2. timelock 太短
│   └── D3. unprotected upgrade
└── E. MEV
    ├── E1. open 大单 sandwich
    └── E2. liquidator 抢跑
```

## 6. 缓解清单

- M1：Mark price = (Chainlink + TWAP) median，偏差 > 3% 暂停
- M2：funding cap 0.75% / 8h
- M3：liquidator self-call 禁止（require msg.sender != positionOwner）
- M4：所有 admin tx 走 48h timelock
- M5：Forta bot 监控 mark price 偏差 + 大额 OI 变化
- M6：rate limit：单 tx open size < pool depth × 5%
