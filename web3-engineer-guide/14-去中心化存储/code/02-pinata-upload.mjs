// 02-pinata-upload.mjs
// 演示：上传单文件到 Pinata，并校验返回的 CID 与本地计算一致。
//
// 前置：在 .env 中配置 PINATA_JWT
// 运行：node 02-pinata-upload.mjs <filepath>

import { PinataSDK } from 'pinata';
import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';
import fs from 'node:fs/promises';
import 'dotenv/config';

const filePath = process.argv[2] || './sample.txt';

async function main() {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('请在 .env 中配置 PINATA_JWT');

  // 1. 读文件 + 本地计算 CID
  const bytes = await fs.readFile(filePath);
  const helia = await createHelia({ start: false });
  const fsHelia = unixfs(helia, { rawLeaves: true });
  const localCid = await fsHelia.addBytes(bytes);
  console.log('本地计算的 CID:', localCid.toString());
  await helia.stop();

  // 2. 上传到 Pinata
  const pinata = new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: 'gateway.pinata.cloud',
  });

  const file = new File([bytes], filePath.split('/').pop(), {
    type: 'application/octet-stream',
  });

  const upload = await pinata.upload.file(file);
  console.log('Pinata 返回的 CID:', upload.cid);

  // 3. 校验
  if (localCid.toString() === upload.cid) {
    console.log('✅ CID 一致，上传无篡改');
  } else {
    console.warn('⚠️ CID 不一致；可能是 chunking 策略不同');
    console.warn('  → 检查 unixfs 的 rawLeaves / chunker 选项');
  }

  // 4. 输出可访问 URL
  console.log(`\n访问方式：`);
  console.log(`  https://gateway.pinata.cloud/ipfs/${upload.cid}`);
  console.log(`  https://ipfs.io/ipfs/${upload.cid}`);
  console.log(`  https://dweb.link/ipfs/${upload.cid}`);
}

main().catch((e) => {
  console.error('上传失败:', e);
  process.exit(1);
});
