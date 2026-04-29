# 习题 1：EIP-712 签名钓鱼检测

## 背景

绝大多数钱包资产损失发生在签名钓鱼：用户在不可信网站签了一个看似无害但实则给攻击者无限授权的 EIP-712 消息。dApp 端可以做一道防线：在调 `signTypedData` 之前自检风险并展示给用户。

## 任务

实现 `detectPhishing(input): Inspection` 纯函数（不依赖 hook），输入一个 typed data 签名请求，输出风险评估。

```ts
type RiskLevel = 'low' | 'medium' | 'high'

interface Inspection {
  domainOk: boolean        // domain.name + chainId + verifyingContract 全齐
  chainMatched: boolean    // 与 currentChainId 一致
  knownContract: boolean   // verifyingContract 在白名单
  approvalDetected: { token: Address, spender: Address, amount: bigint } | null
  expiresAt: Date | null
  humanReadable: string    // "把 1000 USDC 授权给 0xabc，1 小时内"
  risks: { level: RiskLevel; message: string }[]
}

function detectPhishing(input: {
  domain: { name?: string; version?: string; chainId?: number; verifyingContract?: Address }
  types: Record<string, { name: string; type: string }[]>
  primaryType: string
  message: any
  currentChainId: number
}): Inspection
```

## 要求

1. **白名单**：内置 Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3`)、UniswapV2/V3 Router 等已知合约，扩展点保留 `extra: Address[]` 参数。
2. **跨链检测**：`domain.chainId !== currentChainId` → high。
3. **无限授权检测**：`amount === MaxUint256` → high；否则把 amount + decimals 翻译人类语言。
4. **deadline 检测**：> 24h → medium；> 7d → high。
5. **未知 primaryType**：白名单只放常见类型（`PermitTransferFrom`、`Permit`、`OrderComponents`、`SafeTx`）；其他 → low + "未知 primaryType"。
6. **附 vitest 单测**：覆盖至少 6 个用例（正常 Permit2 / 无限授权 / 跨链 / 未知合约 / 长 deadline / OpenSea Seaport）。

## 提示

- 用 `viem.parseAbiParameters` 校验 types 字段格式。
- decimals 不一定能从 message 拿到；可以通过链上调用 `erc20.decimals()` 拿，但纯函数版优先用入参 `decimalsOverride` 注入。
- 渲染 humanReadable 时把 `bigint` formatUnits 化（例如 `1000.000000`）。

## 进阶

把 `detectPhishing` 包装成 React Hook `useEip712Inspector`，在 `signTypedData` 前自动调用，risks ≥ medium 时弹确认对话框。`code/src/hooks/useEip712Inspector.ts` 已有简化版，可以参考扩展。

## 解答提示

`solution/` 目录留空，作为练习目标。完整答案见 `code/src/hooks/useEip712Inspector.ts` 与主 README §10 的实现思路。
