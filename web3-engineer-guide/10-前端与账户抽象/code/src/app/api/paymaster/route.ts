/**
 * ERC-7677 paymaster 代理端点。
 *
 * 前端走 /api/paymaster 而不是直连 Pimlico，目的：
 *   1. 隐藏 PIMLICO_API_KEY，不暴露到 client bundle。
 *   2. 加策略：白名单合约、用户上限、UserOp 字段校验。
 *   3. 未来可换 provider 不用改前端。
 *
 * 这里只示范 1（隐藏 key），策略部分留作练习。
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'PIMLICO_API_KEY 未配置' }, { status: 500 })
  }
  const body = await request.json()
  const upstream = await fetch(`https://api.pimlico.io/v2/sepolia/rpc?apikey=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await upstream.json()
  return NextResponse.json(json)
}
