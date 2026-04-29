import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { cookieToInitialState } from 'wagmi'
import { Providers } from '@/components/Providers'
import { config } from '@/lib/wagmi'
import './globals.css'

export const metadata: Metadata = {
  title: 'Web3 Engineer Guide - Module 10',
  description: '前端与账户抽象 演示项目',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await headers()).get('cookie')
  const initialState = cookieToInitialState(config, cookie)

  return (
    <html lang="zh-CN">
      <body>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  )
}
