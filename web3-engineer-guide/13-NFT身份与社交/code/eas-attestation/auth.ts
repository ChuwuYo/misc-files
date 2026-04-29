/**
 * SIWE + EAS 认证后端逻辑（与 framework 解耦）
 * 真实部署里把这些函数挂到你的 framework router（Next/Express/Hono...）
 */

import { SiweMessage, generateNonce } from 'siwe'
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk'
import { ethers } from 'ethers'

// pin: siwe@2.3.2, @ethereum-attestation-service/eas-sdk@2.7.0
// EAS mainnet 部署地址：https://docs.attest.org/docs/quick--start/contracts （检索 2026-04）
export const EAS_MAINNET = '0xC2679fBD37d54388Ce493F1DB75320D236e1815e'
export const EAS_BASE = '0x4200000000000000000000000000000000000021'
// 注：每条链各自有部署，使用前查官方 deployment 表

/**
 * 生成 nonce 给前端。后端 session 必须存这个 nonce 直到 verify 完成
 */
export function makeNonce(): string {
  return generateNonce()
}

/**
 * 验证用户提交的 SIWE 签名
 * @returns 验证后的 address。失败抛错
 */
export async function verifySiwe(
  message: string,
  signature: string,
  expectedNonce: string,
  expectedDomain: string,
): Promise<string> {
  const siwe = new SiweMessage(message)
  const { data, success } = await siwe.verify({
    signature,
    nonce: expectedNonce,
    domain: expectedDomain,
    // why: domain 由后端硬编码 hostname，避免信任前端传入
  })

  if (!success) throw new Error('SIWE verification failed')
  return data.address
}

/**
 * 颁发链上 EAS attestation
 * @param attesterPk 签发方私钥（服务器侧管理，用 KMS 替代生产环境）
 * @param schemaUid 已注册的 schema UID
 * @param recipient 受益地址
 * @param score 1-100 reputation score（教学用最简 schema）
 */
export async function issueAttestation(
  rpcUrl: string,
  attesterPk: string,
  easAddress: string,
  schemaUid: string,
  recipient: string,
  score: number,
  reason: string,
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const signer = new ethers.Wallet(attesterPk, provider)
  const eas = new EAS(easAddress)
  eas.connect(signer)

  // why: 强类型 schema encode，避免手写 abi.encode 错位
  const encoder = new SchemaEncoder('uint8 score, string reason')
  const data = encoder.encodeData([
    { name: 'score', value: score, type: 'uint8' },
    { name: 'reason', value: reason, type: 'string' },
  ])

  const tx = await eas.attest({
    schema: schemaUid,
    data: {
      recipient,
      expirationTime: 0n,
      revocable: true,
      data,
    },
  })

  const uid = await tx.wait()
  return uid
}
