/**
 * blob-watcher: 实时监听 Ethereum 主网最新区块，过滤 type-3 blob 交易
 * 并按已知 batcher 地址打标签（Base / OP / Arbitrum 等）。
 *
 * 用法：
 *   cp .env.example .env  # 填 MAINNET_RPC
 *   npm install
 *   npm start
 */

import 'dotenv/config';
import { createPublicClient, webSocket, http, type Hex } from 'viem';
import { mainnet } from 'viem/chains';

// 已知 batcher 地址（截至 2026-04，部分；运行时请用 L2BEAT 校验最新）
const BATCHERS: Record<string, string> = {
  '0x6887246668a3b87f54deb3b94ba47a6f63f32985': 'Base/OP-shared-batcher',
  '0x1c479675ad559dc151f6ec7ed3fbf8cee79582b6': 'Arbitrum One',
  '0xdf04f3a2a7b3f69f80f0edff25fdab5cf1a1f2ef': 'Scroll',
  '0xa9b6b0a8ed5c7a82d1b2ff7c95c5c4a8e8b0a8ed': 'Linea',
};

function label(addr: string | null | undefined): string {
  if (!addr) return 'unknown';
  return BATCHERS[addr.toLowerCase()] ?? `unknown(${addr.slice(0, 10)}…)`;
}

async function main() {
  const url = process.env.MAINNET_RPC;
  if (!url) throw new Error('MAINNET_RPC not set in .env');

  const transport = url.startsWith('ws') ? webSocket(url) : http(url);
  const client = createPublicClient({ chain: mainnet, transport });

  console.log('blob-watcher running, MAINNET_RPC =', url);

  client.watchBlocks({
    includeTransactions: false,
    onBlock: async (block) => {
      const full = await client.getBlock({
        blockHash: block.hash as Hex,
        includeTransactions: true,
      });

      const blobTxs = (full.transactions as any[]).filter(
        (tx) => tx.type === 'eip4844' || tx.typeHex === '0x3'
      );

      if (blobTxs.length === 0) return;

      console.log(`\nBlock ${full.number} (${blobTxs.length} blob tx)`);
      for (const tx of blobTxs) {
        const tag = label(tx.to);
        const blobCount = tx.blobVersionedHashes?.length ?? 0;
        const maxBlobFee = tx.maxFeePerBlobGas?.toString() ?? '?';
        console.log(
          `  [${tag.padEnd(24)}] ${tx.hash} blobs=${blobCount} maxFeePerBlobGas=${maxBlobFee} wei`
        );
      }
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
