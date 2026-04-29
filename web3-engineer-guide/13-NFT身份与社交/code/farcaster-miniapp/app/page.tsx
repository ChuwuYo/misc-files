/**
 * Farcaster Mini App 主页
 * 教学正文：../../README.md 第 27 章
 *
 * 关键 SDK 调用：
 *   sdk.context        —— 拿到 fid + username + cast context
 *   sdk.actions.ready  —— 通知 host 隐藏 splash screen
 *   sdk.wallet.ethProvider —— EVM provider，发交易直接走用户已连钱包
 */
'use client'

import { useEffect, useState } from 'react'
import { sdk } from '@farcaster/frame-sdk'
import { encodeFunctionData, parseAbi } from 'viem'

const ABI = parseAbi(['function mint() payable'])
const NFT = '0xMyNftContractReplaceMe'
const PRICE_WEI = '0x' + (5n * 10n ** 16n).toString(16) // 0.05 ETH

interface UserCtx {
  fid: number
  username: string
}

export default function Page() {
  const [user, setUser] = useState<UserCtx | null>(null)
  const [tx, setTx] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const ctx = await sdk.context
        // why: ctx.user 已被 host 验证，含 fid 与（可选）username
        setUser({ fid: ctx.user.fid, username: ctx.user.username ?? '' })
      } finally {
        // why: 必须在 useEffect 末尾调 ready，否则用户卡在 splash screen
        await sdk.actions.ready()
      }
    })()
  }, [])

  async function mint() {
    setError(null)
    try {
      const data = encodeFunctionData({ abi: ABI, functionName: 'mint' })
      const result = await sdk.wallet.ethProvider.request({
        method: 'eth_sendTransaction',
        params: [{ to: NFT, data, value: PRICE_WEI }],
      })
      setTx(result as string)
    } catch (e) {
      setError(String(e))
    }
  }

  if (!user) return <div style={{ padding: 16 }}>Loading…</div>

  return (
    <main style={{ padding: 16, fontFamily: 'sans-serif' }}>
      <h1>Hi @{user.username || `fid:${user.fid}`}</h1>
      <p>Mint a unique NFT for 0.05 ETH</p>
      <button onClick={mint}>Mint</button>
      {tx && <p>tx: {tx}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </main>
  )
}
