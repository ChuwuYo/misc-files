/**
 * 01 - viem 2.43.3 连主网，读区块、读账户、估 ERC-20 转账 gas。
 *
 * 跑法：
 *   pnpm i (在 code/ 目录) 然后 pnpm run read
 *   或：npx tsx 01-read-mainnet.ts
 */
import {
  createPublicClient,
  http,
  formatEther,
  formatGwei,
  parseAbi,
  encodeFunctionData,
} from 'viem';
import { mainnet } from 'viem/chains';

// 公开 RPC，限速但免 key。生产环境换成 alchemy/infura/quicknode。
const RPC = 'https://ethereum-rpc.publicnode.com';

const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC),
});

// Vitalik 的地址，方便对照。
const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as const;

// USDC（同时 demo ERC-20 调用编码）。
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);

async function main() {
  // 1) 最新区块
  const block = await client.getBlock({ blockTag: 'latest' });
  console.log('--- 最新区块 ---');
  console.log('number     :', block.number);
  console.log('hash       :', block.hash);
  console.log('timestamp  :', new Date(Number(block.timestamp) * 1000).toISOString());
  console.log('gasUsed    :', block.gasUsed, '/', block.gasLimit);
  console.log('baseFeeWei :', block.baseFeePerGas);
  console.log('baseFeeGwei:', block.baseFeePerGas ? formatGwei(block.baseFeePerGas) : 'n/a');
  console.log('blobGasUsed:', block.blobGasUsed);
  console.log('excessBlob :', block.excessBlobGas);

  // 2) Vitalik 余额（ETH）
  const ethBalance = await client.getBalance({ address: VITALIK });
  console.log('\n--- Vitalik ---');
  console.log('ETH balance:', formatEther(ethBalance));

  // 3) Vitalik USDC 余额（ERC-20）
  const [usdcDecimals, usdcBalance] = await Promise.all([
    client.readContract({ address: USDC, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [VITALIK],
    }),
  ]);
  console.log('USDC raw   :', usdcBalance);
  console.log('USDC fmt   :', Number(usdcBalance) / 10 ** usdcDecimals);

  // 4) 估算 USDC 转账 1 USDC 的 gas（不发送）
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [VITALIK, 1_000_000n], // 1 USDC = 1e6
  });
  const gasEst = await client.estimateGas({
    account: VITALIK,
    to: USDC,
    data,
  });
  console.log('\n--- gas 估算 ---');
  console.log('USDC transfer gas:', gasEst);

  // 5) 当前 1559 fee
  const fees = await client.estimateFeesPerGas();
  console.log('maxFee     :', fees.maxFeePerGas, formatGwei(fees.maxFeePerGas), 'gwei');
  console.log('maxPriority:', fees.maxPriorityFeePerGas, formatGwei(fees.maxPriorityFeePerGas), 'gwei');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
