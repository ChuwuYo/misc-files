'use client'
/**
 * EIP-712 typed data 可读预览 + 风险提示。
 *
 * 风险检测：
 *   - chainId 与当前链不匹配
 *   - verifyingContract 不在白名单
 *   - amount = MaxUint256（无限授权）
 *   - deadline 超过 1 小时
 */
import { useChainId } from 'wagmi'
import { useMemo } from 'react'
import { PERMIT2_ADDRESS } from '@/lib/chains'

const KNOWN_CONTRACTS = new Set<string>([PERMIT2_ADDRESS.toLowerCase()])
const MAX_UINT256 = (1n << 256n) - 1n

export function TypedDataPreview({ value }: { value: { domain: any; types: any; primaryType: string; message: any } }) {
  const chainId = useChainId()
  const risks = useMemo(() => {
    const arr: { level: 'low' | 'med' | 'high'; msg: string }[] = []
    if (typeof value.domain.chainId === 'number' && value.domain.chainId !== chainId) {
      arr.push({ level: 'high', msg: `跨链签名：domain.chainId=${value.domain.chainId} 与当前链 ${chainId} 不一致` })
    }
    const vc = (value.domain.verifyingContract ?? '').toLowerCase()
    if (vc && !KNOWN_CONTRACTS.has(vc)) {
      arr.push({ level: 'med', msg: `verifyingContract ${value.domain.verifyingContract} 不在白名单` })
    }
    const m = value.message
    if (m?.permitted?.amount === MAX_UINT256) {
      arr.push({ level: 'high', msg: '请求 MaxUint256 无限授权' })
    }
    if (typeof m?.deadline === 'bigint') {
      const left = Number(m.deadline) - Math.floor(Date.now() / 1000)
      if (left > 3600) arr.push({ level: 'med', msg: `deadline 超过 1 小时 (${left}s)` })
    }
    if (arr.length === 0) arr.push({ level: 'low', msg: '基本检查通过' })
    return arr
  }, [chainId, value])

  return (
    <div style={{ background: '#f6f6f6', borderRadius: 6, padding: 10, marginTop: 8, fontSize: 12 }}>
      <div style={{ marginBottom: 4 }}>
        <strong>{value.primaryType}</strong>
        <span className="muted"> @ {value.domain.name} (chainId={String(value.domain.chainId)})</span>
      </div>
      <div className="mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#333' }}>
        {JSON.stringify(value.message, (_k, v) => typeof v === 'bigint' ? v.toString() : v, 2)}
      </div>
      <div style={{ marginTop: 6 }}>
        {risks.map((r, i) => (
          <span key={i} className={`tag ${r.level === 'high' ? 'high' : r.level === 'med' ? 'med' : 'low'}`}>{r.msg}</span>
        ))}
      </div>
    </div>
  )
}
