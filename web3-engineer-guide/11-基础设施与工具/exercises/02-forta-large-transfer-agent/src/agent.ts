// Forta agent: 检测 USDC / USDT / DAI 大于阈值的 Transfer
// 验证日期: 2026-04, forta-bot SDK 0.3.x
import {
  Finding,
  FindingSeverity,
  FindingType,
  HandleTransaction,
  TransactionEvent,
  ethers,
} from "@fortanetwork/forta-bot";

// 监控目标: stable 三巨头
const WATCHED_TOKENS: Record<string, { symbol: string; decimals: number; threshold: bigint }> = {
  // USDC
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
    symbol: "USDC",
    decimals: 6,
    threshold: 1_000_000n * 10n ** 6n, // 1M USDC
  },
  // USDT
  "0xdac17f958d2ee523a2206206994597c13d831ec7": {
    symbol: "USDT",
    decimals: 6,
    threshold: 1_000_000n * 10n ** 6n,
  },
  // DAI
  "0x6b175474e89094c44da98b954eedeac495271d0f": {
    symbol: "DAI",
    decimals: 18,
    threshold: 1_000_000n * 10n ** 18n,
  },
};

const ERC20_TRANSFER_EVENT = "event Transfer(address indexed from, address indexed to, uint256 value)";

const handleTransaction: HandleTransaction = async (txEvent: TransactionEvent) => {
  const findings: Finding[] = [];

  for (const [address, meta] of Object.entries(WATCHED_TOKENS)) {
    // filterLog 自动按 address 过滤, 比 manual 解析快得多
    const transfers = txEvent.filterLog(ERC20_TRANSFER_EVENT, address);

    for (const transfer of transfers) {
      const { from, to, value } = transfer.args;
      const amount: bigint = BigInt(value.toString());

      if (amount < meta.threshold) continue;

      const human = (Number(amount / 10n ** BigInt(meta.decimals - 2)) / 100).toLocaleString();

      findings.push(
        Finding.fromObject({
          name: `Large ${meta.symbol} transfer`,
          description: `${human} ${meta.symbol} transferred from ${from} to ${to}`,
          alertId: "LARGE-ERC20-TRANSFER",
          severity: FindingSeverity.Medium,
          type: FindingType.Info,
          metadata: {
            token: meta.symbol,
            from,
            to,
            value: amount.toString(),
            txHash: txEvent.hash,
          },
          // labels 可被下游 bot 消费 (例: 制裁名单交叉)
          labels: [
            { entity: from, entityType: 1, label: "high-value-sender", confidence: 0.9 },
            { entity: to, entityType: 1, label: "high-value-receiver", confidence: 0.9 },
          ],
        }),
      );
    }
  }

  return findings;
};

export default {
  handleTransaction,
};
