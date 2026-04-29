'use client'
/**
 * 全局 Provider：WagmiProvider + QueryClient + RainbowKitProvider + SessionProvider。
 *
 * 注意 SessionProvider 来自 next-auth/react；它内部用 fetch 拉 session，
 * 所以必须是 client component。
 */
import { ReactNode, useState } from 'react'
import { WagmiProvider, type State } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit'
import { SessionProvider } from 'next-auth/react'
import '@rainbow-me/rainbowkit/styles.css'

import { config } from '@/lib/wagmi'

export function Providers({ children, initialState }: { children: ReactNode; initialState?: State }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 12_000, refetchOnWindowFocus: false },
    },
  }))

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme()} modalSize="compact">
          <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
