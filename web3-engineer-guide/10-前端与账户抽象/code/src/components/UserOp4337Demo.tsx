'use client'
/**
 * ERC-4337 v0.7 UserOp 演示。
 *
 * 流程：
 *   1. 用浏览器 wallet 当 owner（signMessage）
 *   2. permissionless.toSafeSmartAccount 拿到 smart account 地址
 *   3. createSmartAccountClient 包装 bundler + paymaster
 *   4. smartClient.sendTransaction 发一笔零值 self-call（演示用）
 */
import { useState } from 'react'
import { useAccount, useWalletClient, useChainId } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import type { Hex } from 'viem'
import { buildSmartAccount } from '@/lib/aa'

export function UserOp4337Demo() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { data: wallet } = useWalletClient()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ smartAddress?: string; txHash?: string; err?: string }>({})

  async function run() {
    if (!address || !wallet) return
    if (chainId !== sepolia.id) {
      setResult({ err: '请先把钱包切到 Sepolia' })
      return
    }
    setBusy(true)
    setResult({})
    try {
      const { smartClient, safeAccount } = await buildSmartAccount({
        address,
        async sign(hash: Hex) {
          // 浏览器钱包的 personal_sign 会自动加 \x19 前缀；
          // permissionless 期望 raw hash 上的 65 字节签名，因此用 signMessage({ raw })
          return await wallet.signMessage({ account: address, message: { raw: hash } })
        },
      })
      const smartAddress = safeAccount.address
      // 演示：发一笔 0 ETH 到自己（部署 + 验证 + 执行）
      const txHash = await smartClient.sendTransaction({ to: smartAddress, value: 0n, data: '0x' })
      setResult({ smartAddress, txHash })
    } catch (e) {
      setResult({ err: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>6. ERC-4337 v0.7 UserOp（Pimlico bundler + paymaster）</h2>
      {!isConnected && <p className="muted">请先连接钱包</p>}
      {isConnected && (
        <>
          <button disabled={busy || !wallet} onClick={run}>
            {busy ? '构造 + 签名 + 广播 UserOp...' : '发送一笔 4337 UserOp（自调用）'}
          </button>
          <div className="kv" style={{ marginTop: 8 }}>
            <div>EntryPoint</div><div className="mono">v0.7 (0x0000...32)</div>
            <div>smart account</div><div className="mono">{result.smartAddress ?? '-'}</div>
            <div>tx hash</div><div className="mono">{result.txHash ?? '-'}</div>
          </div>
          {result.err && <p className="hint" style={{ color: 'var(--danger)' }}>{result.err}</p>}
          <p className="hint">首次调用会触发 Safe 工厂部署 + 签名验证 + 自调用，gas 由 Pimlico paymaster 赞助。</p>
        </>
      )}
    </div>
  )
}
