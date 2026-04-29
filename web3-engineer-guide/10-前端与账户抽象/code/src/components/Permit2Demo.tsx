'use client'
/**
 * Permit2 SignatureTransfer 演示。
 * 这里只演示"签出 EIP-712 签名"，把 (message, signature) 给后端 relayer
 * 才能真正完成 gasless 流程。本项目教学用，故只展示签名结果。
 */
import { useState } from 'react'
import { useAccount, useChainId, useSignTypedData } from 'wagmi'
import { isAddress, type Address } from 'viem'
import { buildPermit2Message } from '@/lib/permit2'
import { USDC_SEPOLIA, USDC_MAINNET } from '@/lib/chains'
import { TypedDataPreview } from './TypedDataPreview'

export function Permit2Demo() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const usdc: Address = chainId === 1 ? USDC_MAINNET : USDC_SEPOLIA

  const [spender, setSpender] = useState('')
  const [amount, setAmount] = useState('1')
  const [signature, setSignature] = useState<string | null>(null)
  const { signTypedDataAsync, isPending } = useSignTypedData()

  const validSpender = isAddress(spender) ? (spender as Address) : undefined

  const args = validSpender
    ? buildPermit2Message({
      token: usdc,
      amount: BigInt(Math.max(0, Number(amount) || 0)) * 10n ** 6n,
      spender: validSpender,
      deadlineSec: 5 * 60,
      chainId,
    })
    : null

  async function sign() {
    if (!args) return
    const sig = await signTypedDataAsync({
      domain: args.domain,
      types: args.types,
      primaryType: args.primaryType,
      message: args.message,
    })
    setSignature(sig)
  }

  return (
    <div className="card">
      <h2>5. Permit2 SignatureTransfer（gasless approval）</h2>
      {!isConnected && <p className="muted">请先连接钱包</p>}
      {isConnected && (
        <>
          <div className="row">
            <input value={spender} onChange={(e) => setSpender(e.target.value)} placeholder="spender 地址 0x..." style={{ width: 360 }} />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="USDC 数量" style={{ width: 100 }} />
            <button disabled={!args || isPending} onClick={sign}>
              {isPending ? '签名中...' : '签 Permit2'}
            </button>
          </div>
          {args && <TypedDataPreview value={args} />}
          {signature && (
            <div className="kv" style={{ marginTop: 8 }}>
              <div>signature</div><div className="mono" style={{ wordBreak: 'break-all' }}>{signature}</div>
            </div>
          )}
          <p className="hint">把 (message, signature) 提交给你的 relayer，relayer 调 Permit2.permitTransferFrom 完成转账。</p>
        </>
      )}
    </div>
  )
}
