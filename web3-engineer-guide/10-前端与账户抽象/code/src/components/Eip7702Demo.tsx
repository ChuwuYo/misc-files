'use client'
/**
 * EIP-7702 演示：让 EOA 临时挂载 BatchExecutor 合约 code。
 *
 * 注意：本演示假定 Sepolia 已激活 Pectra（实际 2025-05-07 已激活）。
 * 主网体验同样路径，把 chain 换 mainnet 即可。
 *
 * 重要安全约束：永远不传 chainId=0；显式用当前链 ID。
 */
import { useState } from 'react'
import { useAccount, useWalletClient, useChainId } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { isAddress, encodeFunctionData, parseAbi } from 'viem'

const BATCH_EXECUTOR_ABI = parseAbi([
  'function executeBatch((address to, uint256 value, bytes data)[] calls)',
] as const)

export function Eip7702Demo() {
  const { address, isConnected } = useAccount()
  const { data: wallet } = useWalletClient()
  const chainId = useChainId()

  const batchExecutor = process.env.NEXT_PUBLIC_BATCH_EXECUTOR ?? ''
  const [busy, setBusy] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function run() {
    setErr(null); setHash(null)
    if (!address || !wallet) return
    if (!isAddress(batchExecutor) || batchExecutor === '0x0000000000000000000000000000000000000000') {
      setErr('请在 .env.local 设置 NEXT_PUBLIC_BATCH_EXECUTOR 为已部署的合约地址')
      return
    }
    if (chainId !== sepolia.id) {
      setErr('请把钱包切到 Sepolia')
      return
    }
    setBusy(true)
    try {
      // 1. 签 EIP-7702 authorization；显式 chainId，禁止 0
      const authorization = await wallet.signAuthorization({
        account: address,
        contractAddress: batchExecutor as `0x${string}`,
        // viem 默认用当前 chain；我们显式传一遍以防钓鱼
        chainId: sepolia.id,
      })

      // 2. 构造 batch calldata：演示用，调用自身两次零值 call
      const calldata = encodeFunctionData({
        abi: BATCH_EXECUTOR_ABI,
        functionName: 'executeBatch',
        args: [[
          { to: address, value: 0n, data: '0x' },
          { to: address, value: 0n, data: '0x' },
        ]],
      })

      // 3. 发交易：to=自己（已挂载合约 code），authorizationList 附上
      const txHash = await wallet.sendTransaction({
        to: address,
        data: calldata,
        authorizationList: [authorization],
      })
      setHash(txHash)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>7. EIP-7702 EOA 升级 + 批量调用</h2>
      {!isConnected && <p className="muted">请先连接钱包（用支持 EIP-7702 的钱包，例如 2025+ MetaMask）</p>}
      {isConnected && (
        <>
          <p className="hint">合约地址（BatchExecutor）：<span className="mono">{batchExecutor || '未配置'}</span></p>
          <button disabled={busy} onClick={run}>{busy ? '签 + 广播中...' : '发送 7702 batched tx'}</button>
          {hash && <div className="kv" style={{ marginTop: 8 }}><div>tx hash</div><div className="mono">{hash}</div></div>}
          {err && <p className="hint" style={{ color: 'var(--danger)' }}>{err}</p>}
          <p className="hint">本笔交易包含一个 SetCode authorization，让你的 EOA 临时挂载 BatchExecutor.executeBatch，单笔做 2 件事。</p>
        </>
      )}
    </div>
  )
}
