/**
 * ERC-4337 v0.7 Smart Account 工厂。
 *
 * 用 permissionless.js 构造 Safe smart account + Pimlico bundler / paymaster。
 * 所有路径都默认 Sepolia + EntryPoint v0.7。
 *
 * 这一层与 UI 解耦，UI 只通过 useSmartAccount hook 拿 smartClient。
 */
import { createSmartAccountClient } from 'permissionless'
import { toSafeSmartAccount } from 'permissionless/accounts'
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { entryPoint07Address } from 'viem/account-abstraction'
import { createPublicClient, http, type Address, type Hex } from 'viem'
import { sepolia } from 'viem/chains'

export interface SmartAccountOwner {
  address: Address
  /** 给定 hash（已是 EIP-191 prefix 处理过的 message），返回 65 字节 ECDSA 签名 */
  sign: (hash: Hex) => Promise<Hex>
}

export async function buildSmartAccount(owner: SmartAccountOwner) {
  const rpc = process.env.NEXT_PUBLIC_RPC_SEPOLIA
  const apiKey = process.env.NEXT_PUBLIC_PIMLICO_API_KEY
  if (!rpc) throw new Error('NEXT_PUBLIC_RPC_SEPOLIA 未配置')
  if (!apiKey) throw new Error('NEXT_PUBLIC_PIMLICO_API_KEY 未配置')

  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpc) })

  const pimlicoUrl = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${apiKey}`
  const pimlico = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint: { address: entryPoint07Address, version: '0.7' },
  })

  // owner 接口允许我们注入任意 signer：浏览器 wallet、Passkey、HSM 都可。
  const safeAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [
      {
        address: owner.address,
        type: 'local',
        async signMessage({ message }) {
          // permissionless 期望 owner 能签 raw hash；message.raw 是 0x 前缀的 32-byte hash
          if (typeof message === 'string') {
            throw new Error('Safe owner 期望接收 { raw: Hex } 格式的 message')
          }
          return owner.sign(message.raw as Hex)
        },
      } as never,
    ],
    version: '1.4.1',
    entryPoint: { address: entryPoint07Address, version: '0.7' },
  })

  const smartClient = createSmartAccountClient({
    account: safeAccount,
    chain: sepolia,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlico,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlico.getUserOperationGasPrice()).fast,
    },
  })

  return { smartClient, safeAccount, pimlico, publicClient }
}
