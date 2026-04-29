/**
 * 主页：把 7 个演示卡片串起来。
 * 设计原则：每张卡独立可读，不需要前置依赖（除"连接钱包"外）。
 */
import { Connect } from '@/components/ConnectButton'
import { BalanceCard } from '@/components/BalanceCard'
import { ReadContractCard } from '@/components/ReadContractCard'
import { TransferForm } from '@/components/TransferForm'
import { SiweLogin } from '@/components/SiweLogin'
import { Permit2Demo } from '@/components/Permit2Demo'
import { UserOp4337Demo } from '@/components/UserOp4337Demo'
import { Eip7702Demo } from '@/components/Eip7702Demo'

export default function Home() {
  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1>Module 10：前端与账户抽象</h1>
          <p className="muted">Next.js 15 · viem 2.47 · wagmi 2.18 · RainbowKit 2.2 · permissionless 0.2 · NextAuth v5</p>
        </div>
        <Connect />
      </header>
      <BalanceCard />
      <ReadContractCard />
      <TransferForm />
      <SiweLogin />
      <Permit2Demo />
      <UserOp4337Demo />
      <Eip7702Demo />
      <p className="hint" style={{ marginTop: 32 }}>
        本项目所有依赖都 pin 到具体版本，详见 <code>package.json</code>。需要 .env.local 中配置 RPC、Reown projectId、Pimlico key。
      </p>
    </main>
  )
}
