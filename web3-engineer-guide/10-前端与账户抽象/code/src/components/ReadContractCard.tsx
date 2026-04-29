'use client'
import { useAccount, useReadContracts, useChainId } from 'wagmi'
import { parseAbi, formatUnits, type Address } from 'viem'
import { USDC_SEPOLIA, USDC_MAINNET } from '@/lib/chains'

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
] as const)

export function ReadContractCard() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const usdc: Address = chainId === 1 ? USDC_MAINNET : USDC_SEPOLIA

  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: usdc, abi: erc20Abi, functionName: 'symbol' },
      { address: usdc, abi: erc20Abi, functionName: 'decimals' },
      { address: usdc, abi: erc20Abi, functionName: 'balanceOf', args: address ? [address] : undefined },
    ],
    allowFailure: true,
    query: { enabled: !!address },
  })

  const symbol = data?.[0]?.result as string | undefined
  const decimals = data?.[1]?.result as number | undefined
  const balance = data?.[2]?.result as bigint | undefined

  return (
    <div className="card">
      <h2>2. 读合约：USDC</h2>
      {!isConnected && <p className="muted">请先连接钱包</p>}
      {isConnected && (
        <div className="kv">
          <div>USDC 合约</div><div className="mono">{usdc}</div>
          <div>状态</div><div>{isLoading ? '读取中...' : '已读取'}</div>
          <div>symbol</div><div>{symbol ?? '-'}</div>
          <div>decimals</div><div>{decimals ?? '-'}</div>
          <div>余额</div>
          <div className="mono">
            {balance !== undefined && decimals !== undefined ? formatUnits(balance, decimals) : '-'}
          </div>
        </div>
      )}
      <p className="hint">实现细节：useReadContracts 会自动用 Multicall3 批读，节省 RPC 调用。</p>
    </div>
  )
}
