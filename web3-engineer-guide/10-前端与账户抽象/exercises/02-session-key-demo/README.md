# 习题 2：Session Key 一次授权多次交易

## 背景

链游、订阅服务、DEX 限价单都需要"一次授权后用户长期不被打扰"。Smart account + Session Key 是 2026 主流方案。

## 任务

用 ZeroDev Kernel + ERC-7579 SessionKeyValidator 实现：

1. 用户用主 owner 签一次"授权 session key 在 1 小时内、最多 5 笔、单笔上限 5 USDC、仅限调用 USDC.transfer 给指定接收者"。
2. UI 上点 5 个按钮"自动转账"，每次都用 session key 签（不弹钱包），后台广播 UserOp。
3. 1 小时后或 5 笔用完，session key 失效。
4. 主 owner 可以随时一笔 revoke。

## 技术栈

- `@zerodev/sdk`（最新版本：`5.4.x`）
- `permissionless`
- `viem`
- 测试链：Sepolia
- bundler/paymaster：Pimlico 或 ZeroDev Project ID

## 关键 API

```ts
import { createKernelAccount, createKernelAccountClient } from '@zerodev/sdk'
import { toECDSAValidator } from '@zerodev/ecdsa-validator'
import { toPermissionValidator } from '@zerodev/permissions'
import { toECDSASigner } from '@zerodev/permissions/signers'
import { toCallPolicy, toSudoPolicy } from '@zerodev/permissions/policies'
```

主要步骤：

```ts
// 1. 主 owner validator
const sudoValidator = await toECDSAValidator(publicClient, { signer: ownerSigner, ... })

// 2. session key signer + permissionValidator
const sessionSigner = toECDSASigner({ signer: privateKeyToAccount(generatedKey) })
const permissionValidator = await toPermissionValidator(publicClient, {
  signer: sessionSigner,
  policies: [
    toCallPolicy({
      permissions: [{
        target: USDC,
        valueLimit: 0n,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [{ condition: 'equal', value: RECIPIENT }, { condition: 'lessThan', value: 5_000_000n }],
      }],
    }),
    toRateLimitPolicy({ count: 5, interval: 3600 }),
  ],
})

// 3. 部署 / 升级 Kernel：sudoValidator 主、permissionValidator 副
const kernel = await createKernelAccount(publicClient, {
  plugins: { sudo: sudoValidator, regular: permissionValidator },
  ...
})

// 4. 用 sessionSigner 在前端连发 5 笔，自动通过 permissionValidator 走 4337
```

## 要求

1. UI 包含：授权按钮（弹主钱包签 1 次）→ 5 个"自动转账"按钮（不弹钱包）→ revoke 按钮。
2. 失效后再点按钮报"session 已过期"（不要静默失败）。
3. session key 私钥仅存在浏览器内存（不要 localStorage 持久化），刷新即失效（更安全）。
4. UI 上展示剩余次数 + 剩余时间。

## 提示

- ZeroDev 的 `toRateLimitPolicy` + `toCallPolicy` 组合最直接。
- session key 私钥用 `crypto.randomBytes(32)` 在前端生成。
- 给主 owner 一个 emergency revoke 按钮：调 kernel 的 uninstall plugin。

## 进阶

替换 ECDSA session key 为 Passkey（WebAuthn）：用 `@zerodev/webauthn-validator`。这样 session 私钥根本不在 JS 里，更安全。
