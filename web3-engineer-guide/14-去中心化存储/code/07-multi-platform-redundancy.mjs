// 07-multi-platform-redundancy.mjs
// 演示：把同一份数据并行上传到 Pinata + Lighthouse + Filebase（如有）。
// 任何单一平台关停都不会丢数据。
//
// 前置：.env 中配置 PINATA_JWT、LIGHTHOUSE_API_KEY
// 运行：node 07-multi-platform-redundancy.mjs <filepath>

import { PinataSDK } from 'pinata';
import lighthouse from '@lighthouse-web3/sdk';
import fs from 'node:fs/promises';
import 'dotenv/config';

const filePath = process.argv[2] || './sample.txt';

async function uploadToPinata(filename, bytes) {
  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: 'gateway.pinata.cloud',
  });
  const file = new File([bytes], filename);
  const upload = await pinata.upload.file(file);
  return { provider: 'Pinata', cid: upload.cid };
}

async function uploadToLighthouse(filePath) {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  const response = await lighthouse.upload(filePath, apiKey);
  return { provider: 'Lighthouse', cid: response.data.Hash };
}

async function main() {
  const bytes = await fs.readFile(filePath);
  const filename = filePath.split('/').pop();

  // 并行上传到所有可用平台
  const tasks = [
    uploadToPinata(filename, bytes).catch((e) => ({ provider: 'Pinata', error: e.message })),
    uploadToLighthouse(filePath).catch((e) => ({ provider: 'Lighthouse', error: e.message })),
    // 可加：Filebase / 4everland / NFT.Storage Long-Term 等
  ];

  const results = await Promise.all(tasks);
  console.log('\n=== 多平台冗余上传结果 ===\n');

  const cids = new Set();
  for (const r of results) {
    if (r.error) {
      console.log(`❌ ${r.provider}: ${r.error}`);
    } else {
      console.log(`✅ ${r.provider}: ${r.cid}`);
      cids.add(r.cid);
    }
  }

  // 关键校验：所有平台返回的 CID 应一致（内容寻址性质）
  if (cids.size === 1) {
    console.log('\n✅ 所有平台 CID 一致，内容寻址无误');
  } else if (cids.size > 1) {
    console.warn('\n⚠️ 平台返回的 CID 不一致：');
    cids.forEach((c) => console.warn('  ' + c));
    console.warn('  通常是不同 chunking 策略导致；任意一个 CID 都能在对应平台访问');
  } else {
    console.error('\n❌ 没有任何平台上传成功，数据未持久化！');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
