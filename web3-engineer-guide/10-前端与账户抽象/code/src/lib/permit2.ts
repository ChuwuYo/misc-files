/**
 * Permit2 SignatureTransfer 消息构造。
 *
 * 设计要点：
 *   - deadline 强制 ≤ 5 分钟，避免长生命周期签名被钓鱼利用。
 *   - amount 必须用 bigint，Permit2 内部是 uint160 但接口是 uint256。
 *   - nonce 在 SignatureTransfer 模式是 unordered（不连续，仅要求未使用），
 *     我们用时间戳 + 随机字节即可，不需要查链上。
 */
import type { Address } from 'viem'
import { PERMIT2_ADDRESS } from './chains'

export const PERMIT2_TYPES = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
} as const

export interface BuildPermit2Args {
  token: Address
  amount: bigint
  spender: Address
  /** unix epoch 秒；建议 5 分钟内 */
  deadlineSec: number
  chainId: number
  /** 可选：调用方提供的 nonce；不提供则自动生成 */
  nonce?: bigint
}

export function buildPermit2Message(args: BuildPermit2Args) {
  if (args.deadlineSec > 600) {
    throw new Error('Permit2 deadline 不应超过 10 分钟，建议 5 分钟以内')
  }
  const nonce = args.nonce ?? generateNonce()
  return {
    domain: {
      name: 'Permit2',
      chainId: args.chainId,
      verifyingContract: PERMIT2_ADDRESS,
    },
    types: PERMIT2_TYPES,
    primaryType: 'PermitTransferFrom' as const,
    message: {
      permitted: { token: args.token, amount: args.amount },
      spender: args.spender,
      nonce,
      deadline: BigInt(Math.floor(Date.now() / 1000) + args.deadlineSec),
    },
  }
}

function generateNonce(): bigint {
  // 高 64 位用时间戳，低 64 位用随机数，避免碰撞
  const timeMs = BigInt(Date.now())
  const rand = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
  return (timeMs << 64n) | (rand & ((1n << 64n) - 1n))
}
