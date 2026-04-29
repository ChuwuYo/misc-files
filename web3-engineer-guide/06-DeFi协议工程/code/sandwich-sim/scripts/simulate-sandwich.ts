/**
 * 教学版 sandwich 攻击模拟器（占位骨架）。
 *
 * ⚠️ 严禁连真实 Flashbots/主网。本脚本仅在本地 anvil fork 上做"如果发生会怎样"的事后分析。
 *
 * 完整流程见 README.md。这里给一个最小可运行的 stub：
 *   1. 检查环境变量
 *   2. 连接 anvil fork
 *   3. 演示 quote 一笔 swap 的滑点（不真发 tx，不组 bundle）
 *
 * 真正的 mempool 监听 + 利润计算留作练习。
 */
import { createPublicClient, http, formatEther } from "viem";
import { mainnet } from "viem/chains";

const ANVIL_RPC = process.env.ANVIL_RPC_URL ?? "http://127.0.0.1:8545";

async function main() {
  console.log("[sandwich-sim] educational stub starting...");
  console.log(`[sandwich-sim] connecting to anvil at ${ANVIL_RPC}`);

  const client = createPublicClient({
    chain: mainnet,
    transport: http(ANVIL_RPC),
  });

  try {
    const block = await client.getBlockNumber();
    console.log(`[sandwich-sim] connected. current fork block = ${block}`);
  } catch (err) {
    console.error("[sandwich-sim] could not reach anvil. start it first:");
    console.error("  anvil --fork-url $MAINNET_RPC_URL --auto-impersonate");
    process.exit(1);
  }

  // === 占位逻辑：真实实现要做的事 ===
  // 1. ws.watchPendingTransactions 订阅 mempool
  // 2. 解析 UniV2/V3 swap calldata
  // 3. fork.snapshot() -> 模拟 victim tx -> 量化滑点
  // 4. 假设 attacker front-run X% 资金，再 back-run，算净利
  // 5. 减 gas + builder tip
  // 6. fork.revert() 回到原状态
  // 7. 只打印结果，绝不真发

  const fakeVictimAmount = 10n * 10n ** 18n;
  const fakeProfit = (fakeVictimAmount * 3n) / 1000n; // 假设 0.3% 滑点收益
  const fakeGas = 5n * 10n ** 16n; // 0.05 ETH
  const net = fakeProfit > fakeGas ? fakeProfit - fakeGas : 0n;

  console.log("[sandwich-sim] === simulated example ===");
  console.log(`  victim swap : ${formatEther(fakeVictimAmount)} ETH`);
  console.log(`  gross profit: ${formatEther(fakeProfit)} ETH`);
  console.log(`  gas cost    : ${formatEther(fakeGas)} ETH`);
  console.log(`  net profit  : ${formatEther(net)} ETH`);
  console.log("[sandwich-sim] (this is fake math, see README for real impl)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
