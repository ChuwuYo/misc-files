# Module 10 演示项目

Next.js 15 + viem 2.47 + wagmi 2.18 + RainbowKit 2.2 + permissionless 0.2 + NextAuth v5。

所有依赖在 `package.json` 中 pin 到具体版本，使用 pnpm 9.15 管理。

## 启动

```bash
cp .env.example .env.local
# 在 .env.local 中填 RPC、PROJECT_ID、API key
pnpm install
pnpm dev
# http://localhost:3000
```

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `NEXTAUTH_URL` | 通常 `http://localhost:3000`；NextAuth 校验 SIWE domain 用 |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` 生成 |
| `NEXT_PUBLIC_WC_PROJECT_ID` | https://cloud.reown.com 注册得到 |
| `NEXT_PUBLIC_RPC_SEPOLIA / MAINNET / BASE` | Alchemy / QuickNode / Infura |
| `NEXT_PUBLIC_PIMLICO_API_KEY` | https://dashboard.pimlico.io |
| `NEXT_PUBLIC_BATCH_EXECUTOR` | EIP-7702 演示用：BatchExecutor 合约地址（自部署） |

## 演示模块

| 模块 | 入口 | 知识点 |
| --- | --- | --- |
| 1. ETH 余额 | `BalanceCard` | useAccount + useBalance |
| 2. 读 USDC | `ReadContractCard` | useReadContracts + Multicall3 |
| 3. 转 USDC | `TransferForm` | simulate → write → wait |
| 4. SIWE 登录 | `SiweLogin` | EIP-4361 + NextAuth Credentials |
| 5. Permit2 签名 | `Permit2Demo` | EIP-712 + SignatureTransfer + 防钓鱼 |
| 6. 4337 UserOp | `UserOp4337Demo` | permissionless + Pimlico bundler/paymaster |
| 7. EIP-7702 batched | `Eip7702Demo` | signAuthorization + authorizationList |

## 安全约定

- 所有 write 必先 simulate，UI 显示 simulate 结果。
- Typed data 在 `TypedDataPreview` 渲染，标记跨链 / 未知合约 / 无限授权。
- Permit2 deadline ≤ 5 分钟。
- 7702 authorization 强制传当前 chainId，禁止 0。
- SIWE nonce 一次性、TTL 10 分钟。

## BatchExecutor 合约

EIP-7702 演示需要一个简单的批量执行合约。Solidity 实现：

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BatchExecutor {
  struct Call { address to; uint256 value; bytes data; }

  event BatchExecuted(uint256 count);

  function executeBatch(Call[] calldata calls) external payable {
    require(msg.sender == address(this), "only self");
    for (uint i; i < calls.length; ++i) {
      (bool ok, bytes memory ret) = calls[i].to.call{ value: calls[i].value }(calls[i].data);
      if (!ok) {
        assembly { revert(add(ret, 32), mload(ret)) }
      }
    }
    emit BatchExecuted(calls.length);
  }
}
```

部署到 Sepolia 后把地址填入 `.env.local`。

## 故障排查

| 现象 | 排查 |
| --- | --- |
| 连接钱包但 chainId 不变 | 检查钱包是否在 wagmi config 的 chains 列表 |
| Pimlico 返回 401 | API key 没配；或 region 限制（用 https://api.pimlico.io 美国节点） |
| SIWE 登录 401 | nonce 过期 / 签名时本机时钟错；nonce store 是内存版重启丢 |
| 7702 报 "invalid authorization" | 钱包不支持 Pectra；用 2025+ MetaMask 或脚本钱包 |
| `useSimulateContract` 一直 loading | 输入未通过校验；查 `enabled` 条件 |
