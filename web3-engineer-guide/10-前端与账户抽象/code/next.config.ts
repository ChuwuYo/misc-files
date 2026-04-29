import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // wagmi v2 ESM 友好；Next 15 默认 turbopack。
  experimental: { reactCompiler: false },
  webpack(config) {
    // 兼容 walletconnect 的 indexedDB polyfill
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
}

export default nextConfig
