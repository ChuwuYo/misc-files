# 习题 3：Web2 OAuth 与 Web3 钱包绑定

## 背景

许多 dApp 同时支持 Web2 登录（Google/GitHub 邮件）与 Web3 登录（钱包），但用户希望"我用 Google 登的账号 = 我那个 0xabc 地址"。这需要把 OAuth 与钱包绑定，并防止地址冒充。

## 任务

在 `code/` 项目基础上扩展：

1. NextAuth 加一个 Google Provider。
2. 用户用 Google 登录后，UI 显示"绑定钱包"按钮。
3. 点按钮：拉 nonce → 让用户签一段 SIWE 消息 `Bind <userId> to <address>`（带 nonce）→ 后端 verify → 在数据库（教学用 Map）写 `userId ↔ address`。
4. 后续用户用 Google 登录，session 里同时含 `userId` 和 `address`。
5. 已绑定 A 地址的 userId 不能再绑 B 地址（除非先 unbind）。
6. 反向：钱包先连接、SIWE 登录后，可以"绑定 Google 账号"反向走一次。

## 安全约束

1. **签名地址必须等于当前 wallet account**：前端 `useAccount()` 拿到 address，后端 `siwe.verify` 后比对，不一致拒绝。
2. **nonce 一次性**：复用 `code/src/lib/nonce-store.ts`。
3. **userId 必须从 OAuth session 取**，不可由前端传入（防伪造）。
4. **多设备 session**：用户在新设备登录，应该看到已绑定地址。
5. **SIWE message 中 statement**：明文写 "Bind Google account user_xxx to 0xabc"，让用户清楚授权范围。

## 技术栈

- `next-auth` v5（已在 `code/`）
- `next-auth/providers/google` 加 Google OAuth
- 数据库：开发用 in-memory Map；生产用 Prisma + Postgres / SQLite

## API 设计

```
GET  /api/siwe/nonce            (existing) → { nonce }
POST /api/bind-wallet           { message, signature } → { ok }
GET  /api/me                    → { userId, address?, email? }
POST /api/unbind-wallet         → { ok }
```

## 关键代码片段

```ts
// /api/bind-wallet
import { auth } from '@/lib/auth'
import { SiweMessage } from 'siwe'
export async function POST(req) {
  const session = await auth()
  if (!session?.user?.email) return new Response('unauthorized', { status: 401 })

  const { message, signature } = await req.json()
  const siwe = new SiweMessage(JSON.parse(message))
  const result = await siwe.verify({ signature, nonce: siwe.nonce })
  if (!result.success) return new Response('bad signature', { status: 400 })
  if (!consumeNonce(siwe.nonce)) return new Response('nonce reused', { status: 400 })

  // 必须含 statement 提及 userId
  if (!siwe.statement?.includes(session.user.email)) return new Response('mismatched statement', { status: 400 })

  // 写库
  bindings.set(session.user.email, result.data.address)
  return Response.json({ ok: true })
}
```

## 要求

1. 完整 UI：未登录 → Google 登录 → 已登录 + 未绑定 → 绑定流程 → 已绑定状态。
2. UI 同时支持反向：钱包先连接 → SIWE 登录 → 绑定 Google（OAuth popup）。
3. 防御一遍：不同 Google 账号尝试绑定同一钱包应被拒。
4. 加一个 "解除绑定" 按钮。

## 进阶

拓展支持 Apple、GitHub、Twitter 多个 OAuth provider 同时绑定。每个 provider 一条 `(userId, provider, providerUserId, walletAddress)` 记录，UI 显示已绑定列表。
