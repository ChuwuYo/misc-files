// upload-metadata.mjs
// 演示：批量上传 NFT 图片 + 元数据到 Pinata + Lighthouse 双备份。
//
// 目录结构（运行前准备）：
//   metadata/   1.json 2.json ... N.json
//   images/     1.png  2.png  ... N.png
//
// 运行：node upload-metadata.mjs

import { PinataSDK } from 'pinata';
import lighthouse from '@lighthouse-web3/sdk';
import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

const META_DIR = './metadata';
const IMAGES_DIR = './images';

async function uploadDirectoryToPinata(pinata, dir) {
  const files = await fs.readdir(dir);
  const fileArray = await Promise.all(
    files.sort().map(async (n) => {
      const buf = await fs.readFile(path.join(dir, n));
      return new File([buf], n);
    }),
  );
  const upload = await pinata.upload.fileArray(fileArray);
  return upload.cid;
}

async function main() {
  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: 'gateway.pinata.cloud',
  });

  // 1. 上传图片
  console.log('1/4 上传图片到 Pinata...');
  const imagesCid = await uploadDirectoryToPinata(pinata, IMAGES_DIR);
  console.log('   image base CID:', imagesCid);

  // 2. 重写 metadata.json，把 image 字段改为 ipfs://<CID>/<n>.png
  console.log('2/4 改写 metadata 中的 image 字段...');
  const imageFiles = await fs.readdir(IMAGES_DIR);
  for (const f of imageFiles) {
    const id = f.replace(/\.(png|jpg|jpeg|gif)$/i, '');
    const metaPath = path.join(META_DIR, `${id}.json`);
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
      meta.image = `ipfs://${imagesCid}/${f}`;
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    } catch {
      console.warn(`   跳过 ${metaPath}（不存在或解析失败）`);
    }
  }

  // 3. 上传 metadata 目录到 Pinata
  console.log('3/4 上传 metadata 到 Pinata...');
  const metaCid = await uploadDirectoryToPinata(pinata, META_DIR);
  console.log('   metadata base CID:', metaCid);

  // 4. Lighthouse 备份
  console.log('4/4 备份 metadata 到 Lighthouse...');
  const lhKey = process.env.LIGHTHOUSE_API_KEY;
  if (lhKey) {
    const lhResult = await lighthouse.uploadFolder(META_DIR, lhKey);
    console.log('   Lighthouse CID:', lhResult.data.Hash);
  } else {
    console.warn('   未配置 LIGHTHOUSE_API_KEY，跳过备份');
  }

  console.log('\n=== 部署用 baseURI ===');
  console.log(`BASE_URI="ipfs://${metaCid}/"`);
  console.log('把这个 ipfs:// URI 作为 forge script Deploy.s.sol 的环境变量');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
