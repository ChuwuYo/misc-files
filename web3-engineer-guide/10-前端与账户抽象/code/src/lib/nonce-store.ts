/**
 * SIWE nonce 存储。
 *
 * 教学用：进程内 Map + TTL。生产环境必须用 Redis / Vercel KV / Upstash 等。
 * 关键安全点：
 *   1. nonce 必须服务端生成（crypto.randomBytes）。
 *   2. 一次性，verify 通过后立即销毁。
 *   3. TTL 不超过 10 分钟。
 */
import { randomBytes } from 'crypto'

interface Entry {
  expiresAt: number
  used: boolean
}

const TTL_MS = 10 * 60 * 1000
const store = new Map<string, Entry>()

// 周期清理过期条目，避免内存泄漏
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k)
  }
}, 60_000).unref?.()

export function issueNonce(): string {
  const nonce = randomBytes(16).toString('hex')
  store.set(nonce, { expiresAt: Date.now() + TTL_MS, used: false })
  return nonce
}

export function consumeNonce(nonce: string): boolean {
  const entry = store.get(nonce)
  if (!entry) return false
  if (entry.used) return false
  if (entry.expiresAt < Date.now()) {
    store.delete(nonce)
    return false
  }
  entry.used = true
  // 立即删除，杜绝竞争
  store.delete(nonce)
  return true
}
