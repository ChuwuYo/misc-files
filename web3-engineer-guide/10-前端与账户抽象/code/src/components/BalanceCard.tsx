'use client'
import { useAccount, useBalance } from 'wagmi'
import { formatEther } from 'viem'

export function BalanceCard() {
  const { address, chainId, isConnected } = useAccount()
  const { data, isLoading, isError } = useBalance({ address, chainId, query: { enabled: !!address } })

  return (
    <div className="card">
      <h2>1. ETH 余额</h2>
      {!isConnected && <p className="muted">请先连接钱包</p>}
      {isConnected && (
        <div className="kv">
          <div>地址</div><div className="mono">{address}</div>
          <div>链</div><div className="mono">{chainId}</div>
          <div>余额</div>
          <div className="mono">
            {isLoading && '加载中...'}
            {isError && '读取失败'}
            {data && `${formatEther(data.value)} ${data.symbol}`}
          </div>
        </div>
      )}
    </div>
  )
}
