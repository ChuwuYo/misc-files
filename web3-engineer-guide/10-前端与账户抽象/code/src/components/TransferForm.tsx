'use client'
/**
 * 标准 ERC-20 转账。完整流程：
 *   useSimulateContract  →  useWriteContract  →  useWaitForTransactionReceipt
 *
 * 严格遵守"先 simulate 再 write"的原则。
 */
import { useState } from 'react'
import { useAccount, useChainId, useSimulateContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseAbi, parseUnits, isAddress, type Address } from 'viem'
import { USDC_SEPOLIA, USDC_MAINNET } from '@/lib/chains'

const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
] as const)

export function TransferForm() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const usdc: Address = chainId === 1 ? USDC_MAINNET : USDC_SEPOLIA

  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('1')

  const validTo = isAddress(to) ? (to as Address) : undefined
  const parsedAmount = (() => {
    try { return parseUnits(amount || '0', 6) } catch { return undefined }
  })()

  const sim = useSimulateContract({
    address: usdc,
    abi: erc20Abi,
    functionName: 'transfer',
    args: validTo && parsedAmount !== undefined ? [validTo, parsedAmount] : undefined,
    account: address,
    query: { enabled: !!address && !!validTo && parsedAmount !== undefined && parsedAmount > 0n },
  })

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash })

  return (
    <div className="card">
      <h2>3. 转 USDC（先 simulate 再 write）</h2>
      {!isConnected && <p className="muted">请先连接钱包</p>}
      {isConnected && (
        <>
          <div className="row">
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="接收地址 0x..." style={{ width: 360 }} />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="数量" style={{ width: 80 }} />
            <button
              disabled={!sim.data || isPending}
              onClick={() => sim.data && writeContract(sim.data.request)}
            >
              {isPending ? '钱包确认中...' : '发送'}
            </button>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>
            simulate: {sim.isLoading ? '模拟中...' : sim.isError ? `失败：${sim.error?.shortMessage ?? sim.error?.message}` : sim.data ? '通过' : '等待输入'}
          </div>
          {hash && (
            <div className="kv" style={{ marginTop: 8 }}>
              <div>tx hash</div><div className="mono">{hash}</div>
              <div>状态</div>
              <div>
                {receipt.isLoading && '等待回执...'}
                {receipt.data && receipt.data.status === 'success' && <span className="tag low">成功</span>}
                {receipt.data && receipt.data.status === 'reverted' && <span className="tag high">回滚</span>}
              </div>
            </div>
          )}
          {error && <p className="hint" style={{ color: 'var(--danger)' }}>{(error as Error).message}</p>}
        </>
      )}
    </div>
  )
}
