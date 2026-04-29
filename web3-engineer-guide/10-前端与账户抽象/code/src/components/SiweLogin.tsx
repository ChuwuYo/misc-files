'use client'
/**
 * SIWE 登录组件。
 * 流程：拉 nonce -> 构造 SiweMessage -> personal_sign -> 提交 NextAuth callback。
 */
import { useState } from 'react'
import { useAccount, useChainId, useSignMessage } from 'wagmi'
import { useSession, signIn, signOut } from 'next-auth/react'
import { SiweMessage } from 'siwe'

export function SiweLogin() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()
  const { data: session, status } = useSession()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function login() {
    if (!address) return
    setBusy(true); setErr(null)
    try {
      const nonceRes = await fetch('/api/siwe/nonce').then(r => r.json())
      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: '通过 SIWE 登录 Module 10 演示',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce: nonceRes.nonce,
        issuedAt: new Date().toISOString(),
        expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      const text = message.prepareMessage()
      const signature = await signMessageAsync({ message: text })
      const result = await signIn('credentials', {
        message: JSON.stringify(message),
        signature,
        redirect: false,
      })
      if (result?.error) setErr(result.error)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>4. SIWE 登录</h2>
      {!isConnected && <p className="muted">请先连接钱包</p>}
      {isConnected && (
        <>
          {status === 'authenticated' && session?.user.address ? (
            <div className="row">
              <span>已登录：</span><span className="mono">{session.user.address}</span>
              <button className="secondary" onClick={() => signOut({ redirect: false })}>登出</button>
            </div>
          ) : (
            <button disabled={busy} onClick={login}>{busy ? '签名中...' : 'Sign in with Ethereum'}</button>
          )}
          {err && <p className="hint" style={{ color: 'var(--danger)' }}>{err}</p>}
          <p className="hint">SIWE 消息会包含 domain / chainId / nonce / 5 分钟过期时间，后端 verify 后销毁 nonce。</p>
        </>
      )}
    </div>
  )
}
