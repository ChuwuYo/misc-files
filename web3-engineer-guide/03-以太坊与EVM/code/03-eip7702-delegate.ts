/**
 * 03 - EIP-7702 (Type 4) SetCode：把 EOA 临时变成 batch-call 合约。
 *
 * Sepolia 已支持 7702（Pectra 已激活）。我们用 viem 内置的 `signAuthorization`
 * 给一个已部署在 Sepolia 的简易 BatchCallDelegation 合约签授权，然后用 Type 4 交易
 * 调用自己（msg.sender == self），让自己的 code 字段临时挂上 designator。
 *
 * 关键点：
 *   - authority 私钥在签 authorization 时不付 gas，可以让别人代发（sponsor）
 *   - 这里为了简单，sender 和 authority 是同一把私钥
 *   - 设 to == account.address 让批处理合约的逻辑跑在 EOA 自身的 storage 上
 *
 * 跑法：
 *   SEPOLIA_PRIVATE_KEY=0x... npx tsx 03-eip7702-delegate.ts
 */
import { createPublicClient, createWalletClient, http, parseEther, encodeFunctionData, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

// 一个公开的 BatchCallDelegation 例子合约（来自 viem 文档同名示例，已在 Sepolia 部署）
// 如果失效请自己用 forge 部一个最简版（见 README §11.5）。
const BATCH_DELEGATION = '0xb91Cd6ba12C5b6526fE0eA4D3e4d2a6F7eA8d7Dc' as const;

const batchAbi = parseAbi([
  'struct Call { bytes data; address to; uint256 value; }',
  'function execute(Call[] calls)',
]);

const PK = process.env.SEPOLIA_PRIVATE_KEY as `0x${string}` | undefined;
if (!PK) {
  console.error('请先设置 SEPOLIA_PRIVATE_KEY 环境变量');
  process.exit(1);
}

const account = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC) });

async function main() {
  console.log('EOA:', account.address);

  // 1) 签 EIP-7702 authorization：让自己的 code 指向 BATCH_DELEGATION
  const authorization = await walletClient.signAuthorization({
    contractAddress: BATCH_DELEGATION,
    // executor: 'self' 让 nonce 自动递增到 nonce+1，因为同一笔 tx 也由自己发
    executor: 'self',
  });

  console.log('\nauthorization (chain_id, contract, nonce, y_parity, r, s):');
  console.log(authorization);

  // 2) 构造一笔 batch：自己向自己转两次 0
  const calldata = encodeFunctionData({
    abi: batchAbi,
    functionName: 'execute',
    args: [
      [
        { to: account.address, value: 0n, data: '0x' },
        { to: account.address, value: 0n, data: '0x' },
      ],
    ],
  });

  // 3) 发 Type 4 交易：authorizationList 里挂刚才的 authorization
  const hash = await walletClient.sendTransaction({
    authorizationList: [authorization],
    to: account.address, // 调用自己；msg.sender == self
    data: calldata,
  });

  console.log('\ntx hash:', hash);
  console.log('explorer: https://sepolia.etherscan.io/tx/' + hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('status :', receipt.status);

  // 4) 验证：现在去看自己 EOA 的 code
  const code = await publicClient.getCode({ address: account.address });
  console.log('\nEOA 的 code 字段:', code);
  // 应该是 0xef0100 + 20 字节合约地址（共 23 字节 = 46 hex chars + 0x = 48 chars）
  // 形如: 0xef0100b91cd6ba12c5b6526fe0ea4d3e4d2a6f7ea8d7dc

  // 5) 想撤销：再签一次 authorization 指向 0x0
  console.log('\n要撤销 designator，签一次指向 0x0000...0000 的 authorization 即可。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
