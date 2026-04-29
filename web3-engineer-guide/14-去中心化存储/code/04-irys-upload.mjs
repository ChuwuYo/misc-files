// 04-irys-upload.mjs
// 演示：通过 Irys（前 Bundlr）上传到 Arweave。
// 用 ETH 私钥支付，bundler 内部换 AR。
//
// 前置：在 .env 配置 PRIVATE_KEY（钱包要有少量 ETH）
// 运行：node 04-irys-upload.mjs <filepath>

import Irys from '@irys/sdk';
import fs from 'node:fs/promises';
import 'dotenv/config';

const filePath = process.argv[2] || './sample.txt';

async function main() {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error('请在 .env 配置 PRIVATE_KEY');

  const irys = new Irys({
    url: 'https://node1.irys.xyz',
    token: 'ethereum',
    key,
  });

  const data = await fs.readFile(filePath);
  const size = data.length;

  // 估算费用
  const price = await irys.getPrice(size);
  const priceEth = irys.utils.fromAtomic(price);
  console.log(`上传 ${size} 字节估算: ${priceEth} ETH`);

  // 检查余额
  const balance = await irys.getLoadedBalance();
  console.log(`Irys 节点余额: ${irys.utils.fromAtomic(balance)} ETH`);

  if (balance.lt(price)) {
    const need = price.minus(balance);
    console.log(`余额不足，自动充值 ${irys.utils.fromAtomic(need)} ETH...`);
    const fundTx = await irys.fund(need);
    console.log('充值 TX:', fundTx.id);
  }

  // 上传
  const tags = [
    { name: 'Content-Type', value: 'application/octet-stream' },
    { name: 'App-Name', value: 'Web3-Engineer-Guide' },
    { name: 'App-Version', value: '1.0' },
    { name: 'Module', value: '14-decentralized-storage' },
  ];

  const receipt = await irys.upload(data, { tags });

  console.log('\n--- 上传成功 ---');
  console.log('Arweave TX ID:', receipt.id);
  console.log('永久 URL:    ', `https://arweave.net/${receipt.id}`);
  console.log('Irys 网关:   ', `https://gateway.irys.xyz/${receipt.id}`);
  console.log('AR.IO 网关:  ', `https://ar-io.net/${receipt.id}`);
}

main().catch((e) => {
  console.error('上传失败:', e);
  process.exit(1);
});
