// 01-helia-local-cid.mjs
// 演示：本地用 Helia 计算 CID，不联网。
// 用途：上传前预先得到 CID，上传后比对，可发现 chunking 不一致问题。
//
// 运行：node 01-helia-local-cid.mjs

import { createHelia } from 'helia';
import { unixfs } from '@helia/unixfs';

async function main() {
  // 不启动 libp2p（本地纯计算）
  const helia = await createHelia({ start: false });
  const fs = unixfs(helia);

  const samples = [
    'Hello, decentralized world',
    'Web3 Engineer Guide - Module 14',
    JSON.stringify({ name: 'NFT #1', image: 'ipfs://placeholder' }),
  ];

  for (const text of samples) {
    const bytes = new TextEncoder().encode(text);
    const cid = await fs.addBytes(bytes);
    console.log(`内容: ${text.slice(0, 40)}...`);
    console.log(`CID:  ${cid.toString()}`);
    console.log('---');
  }

  // 关键性质验证：同一内容 → 同一 CID
  const a = await fs.addBytes(new TextEncoder().encode('test'));
  const b = await fs.addBytes(new TextEncoder().encode('test'));
  console.log('CID 确定性:', a.toString() === b.toString() ? '✅ 相等' : '❌ 不相等');

  await helia.stop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
