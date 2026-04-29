/**
 * NextAuth v5 (Auth.js) 配置 + SIWE Credentials Provider。
 *
 * 流程：
 *   1. 前端 GET /api/siwe/nonce 拿 nonce
 *   2. 前端构造 SiweMessage、用 personal_sign 签名
 *   3. 前端 POST /api/auth/callback/credentials { message, signature }
 *   4. 这里的 authorize() 验签 + 校验 nonce + 颁发 session
 */
import NextAuth, { type NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { SiweMessage } from 'siwe'
import { consumeNonce } from './nonce-store'

declare module 'next-auth' {
  interface Session {
    user: {
      address: string
      chainId: number
    }
  }
  interface User {
    address: string
    chainId: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    address?: string
    chainId?: number
  }
}

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Ethereum',
      credentials: {
        message: { label: 'Message', type: 'text' },
        signature: { label: 'Signature', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.message || !credentials.signature) return null
        try {
          const siwe = new SiweMessage(JSON.parse(credentials.message as string))
          const expectedDomain = (process.env.NEXTAUTH_URL ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '')

          const result = await siwe.verify({
            signature: credentials.signature as string,
            nonce: siwe.nonce,
            domain: expectedDomain || undefined,
          })
          if (!result.success) return null

          // 校验 nonce 一次性
          if (!consumeNonce(siwe.nonce)) return null

          return {
            id: result.data.address,
            address: result.data.address,
            chainId: result.data.chainId,
          }
        } catch {
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.address = user.address
        token.chainId = user.chainId
      }
      return token
    },
    async session({ session, token }) {
      if (token.address) session.user.address = token.address
      if (typeof token.chainId === 'number') session.user.chainId = token.chainId
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
