'use client'
/**
 * 通用 EIP-712 检测 hook，可用于任何签 typed data 之前的预检。
 *
 * 与 TypedDataPreview 的差别：
 *   - Preview 是 UI 组件
 *   - Inspector 是纯逻辑 hook，可以在 useEffect / 业务函数里调用
 */
import { useChainId } from 'wagmi'
import { useMemo } from 'react'
import { PERMIT2_ADDRESS } from '@/lib/chains'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface Eip712Inspection {
  domainOk: boolean
  chainMatched: boolean
  knownContract: boolean
  isMaxUintApproval: boolean
  deadlineSeconds: number | null
  risks: { level: RiskLevel; message: string }[]
}

const KNOWN = new Set([PERMIT2_ADDRESS.toLowerCase()])
const MAX_UINT256 = (1n << 256n) - 1n

export function useEip712Inspector(input: {
  domain: { name?: string; chainId?: number; verifyingContract?: string }
  primaryType: string
  message: any
}): Eip712Inspection {
  const currentChainId = useChainId()

  return useMemo(() => {
    const risks: { level: RiskLevel; message: string }[] = []
    const chainMatched = !input.domain.chainId || input.domain.chainId === currentChainId
    if (!chainMatched) {
      risks.push({ level: 'high', message: `跨链签名: domain.chainId=${input.domain.chainId} 与当前 ${currentChainId} 不一致` })
    }
    const vc = (input.domain.verifyingContract ?? '').toLowerCase()
    const knownContract = !vc || KNOWN.has(vc)
    if (vc && !knownContract) {
      risks.push({ level: 'medium', message: `verifyingContract ${input.domain.verifyingContract} 未在白名单` })
    }
    const isMaxUintApproval =
      input.message?.permitted?.amount === MAX_UINT256 ||
      input.message?.value === MAX_UINT256
    if (isMaxUintApproval) risks.push({ level: 'high', message: '请求 MaxUint256 无限授权' })

    let deadlineSeconds: number | null = null
    if (typeof input.message?.deadline === 'bigint') {
      deadlineSeconds = Number(input.message.deadline) - Math.floor(Date.now() / 1000)
      if (deadlineSeconds > 24 * 3600) risks.push({ level: 'medium', message: 'deadline 超过 24 小时' })
    }
    return {
      domainOk: !!input.domain.name,
      chainMatched,
      knownContract,
      isMaxUintApproval,
      deadlineSeconds,
      risks,
    }
  }, [currentChainId, input])
}
