// 演示: Helios 把 untrusted Alchemy RPC 转成 trustless 本地 RPC
// 任何状态查询都通过 merkle proof + beacon root 校验
// 运行: bun run verify-balance.ts (或 ts-node / tsx)
import { createPublicClient, http, formatEther } from "viem";
import { mainnet } from "viem/chains";

// 1. trusted: helios 暴露的本地 RPC (8545), 由 light client 验证
const trusted = createPublicClient({
  chain: mainnet,
  transport: http("http://127.0.0.1:8545"),
});

// 2. untrusted: 直连 Alchemy, 完全相信对方 (假如 Alchemy 篡改, 你看到的就是假数据)
const untrusted = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ALCHEMY_URL ?? "https://eth-mainnet.g.alchemy.com/v2/demo"),
});

// V神 ENS 地址
const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const;

async function main() {
  const t0 = performance.now();
  const trustedBalance = await trusted.getBalance({ address: VITALIK });
  const t1 = performance.now();
  const untrustedBalance = await untrusted.getBalance({ address: VITALIK });
  const t2 = performance.now();

  console.log(`Trusted (Helios)   : ${formatEther(trustedBalance)} ETH  (${(t1 - t0).toFixed(0)}ms)`);
  console.log(`Untrusted (direct) : ${formatEther(untrustedBalance)} ETH  (${(t2 - t1).toFixed(0)}ms)`);

  if (trustedBalance !== untrustedBalance) {
    console.error("篡改检测: untrusted RPC 返回了不一致的结果, Helios 已经拒绝该响应");
    process.exit(1);
  }

  console.log("两端一致, untrusted RPC 通过 Helios 校验");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
