/**
 * 02 - 手动构造一笔 EIP-1559 (Type 2) 交易，本地签名，再丢到 Sepolia 公网。
 *
 * 不依赖任何浏览器钱包。前提：
 *   - 一个 Sepolia 有 ETH 的私钥（去 https://sepoliafaucet.com 领）
 *   - 设置环境变量 SEPOLIA_PRIVATE_KEY=0x...
 *
 * 跑法：
 *   SEPOLIA_PRIVATE_KEY=0xabc... npx tsx 02-sign-and-send-1559.ts
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  formatGwei,
  parseGwei,
  serializeTransaction,
  keccak256,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

const PK = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}` | undefined;
if (!PK) {
  console.error('请先设置 SEPOLIA_PRIVATE_KEY 环境变量');
  process.exit(1);
}

const account = privateKeyToAccount(PK);

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

async function main() {
  console.log('from:', account.address);

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('balance:', formatEther(balance), 'ETH');
  if (balance < parseEther('0.001')) {
    throw new Error('余额过低，先去 sepoliafaucet 领点 ETH');
  }

  // ---------------- 手动构造 Type 2 ----------------
  const nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  const fees = await publicClient.estimateFeesPerGas(); // {maxFeePerGas, maxPriorityFeePerGas}

  // 自己给自己转 0，演示用
  const tx = {
    type: 'eip1559' as const,
    chainId: sepolia.id, // 11155111
    nonce,
    to: account.address,
    value: 0n,
    data: '0x' as const,
    gas: 21_000n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  };

  // 1) 序列化未签名结构（用于打印对照）
  const unsigned = serializeTransaction(tx);
  console.log('\nunsigned RLP:', unsigned);
  console.log('digest      :', keccak256(unsigned));

  // 2) 本地签名
  const signed = await account.signTransaction(tx);
  console.log('\nsigned RLP  :', signed);

  console.log('maxFee      :', formatGwei(tx.maxFeePerGas), 'gwei');
  console.log('maxPriority :', formatGwei(tx.maxPriorityFeePerGas), 'gwei');

  // 3) 广播
  const hash = await walletClient.sendRawTransaction({ serializedTransaction: signed });
  console.log('\ntx hash     :', hash);
  console.log('explorer    : https://sepolia.etherscan.io/tx/' + hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('\nstatus      :', receipt.status);
  console.log('block       :', receipt.blockNumber);
  console.log('gasUsed     :', receipt.gasUsed);
  console.log('effGasPrice :', formatGwei(receipt.effectiveGasPrice), 'gwei');
  // 实际花费 = gasUsed × effectiveGasPrice
  const cost = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log('实际花费    :', formatEther(cost), 'ETH');
  // 其中 base fee × gasUsed 这部分被烧毁
  const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  const burned = receipt.gasUsed * (block.baseFeePerGas ?? 0n);
  console.log('烧毁        :', formatEther(burned), 'ETH');
  console.log('给提议者    :', formatEther(cost - burned), 'ETH');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
