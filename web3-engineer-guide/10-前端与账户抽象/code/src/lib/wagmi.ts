/**
 * wagmi v2 配置中心。
 *
 * 关键点：
 *   1. 所有 chains 必须在 `transports` 里有对应入口，否则 useSwitchChain 调用失败。
 *   2. ssr=true + cookieStorage 让 Next.js 服务端能从 cookie 还原连接状态。
 *   3. injected() 自动消费 EIP-6963（多注入钱包）。
 *   4. walletConnect 的 showQrModal=false 把 modal 让给 RainbowKit。
 *   5. 末尾的 declare module 让 useAccount 等 hook 拿到字面量级 chain 类型。
 */

import { http, createConfig, cookieStorage, createStorage } from 'wagmi'
import { mainnet, sepolia, base } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet, safe } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? 'demo'

export const config = createConfig({
  chains: [sepolia, mainnet, base],
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId,
      metadata: {
        name: 'Web3 Engineer Guide - Module 10',
        description: '前端与账户抽象演示项目',
        url: 'https://example.com',
        icons: ['https://example.com/icon.png'],
      },
      showQrModal: false,
    }),
    coinbaseWallet({ appName: 'Web3 Engineer Guide', preference: 'all' }),
    safe(),
  ],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_SEPOLIA),
    [mainnet.id]: http(process.env.NEXT_PUBLIC_RPC_MAINNET),
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_BASE),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
