# 实战 2：SIWE + EAS 身份后端

教学正文见 `../../README.md` 第 26 章。

## 文件结构

- `package.json` —— 依赖 pin（siwe / eas-sdk / viem / ethers）
- `auth.ts` —— framework 无关的核心认证 + EAS 颁发逻辑

## 跑起来需要

1. 注册 EAS schema（一次性）：
   ```ts
   import { SchemaRegistry } from '@ethereum-attestation-service/eas-sdk'
   const reg = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS)
   reg.connect(signer)
   await reg.register({
     schema: 'uint8 score, string reason',
     resolverAddress: '0x0',
     revocable: true,
   })
   ```

2. 在你的 framework 里挂三个 endpoint：
   - `GET /auth/nonce` → 调 `makeNonce()`，存 session
   - `POST /auth/verify` → 调 `verifySiwe()`，成功后写 cookie
   - `POST /attest` → 调 `issueAttestation()`

3. 前端用 `viem.createSiweMessage` 构造消息 + 钱包签名。

## 安全清单

- nonce 必须 single-use（用完作废）
- domain 后端硬编码，不信任前端
- attester 私钥用 KMS / HSM，永远不进 .env
- attestation revocable 设 true，留 revoke 的紧急通道
