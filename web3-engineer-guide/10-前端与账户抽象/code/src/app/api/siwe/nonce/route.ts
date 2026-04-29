/**
 * SIWE nonce 颁发端点。
 * 任意未登录用户可调；返回的 nonce 在 10 分钟内一次性可用。
 */
import { NextResponse } from 'next/server'
import { issueNonce } from '@/lib/nonce-store'

export const runtime = 'nodejs'

export async function GET() {
  const nonce = issueNonce()
  return NextResponse.json({ nonce })
}
