// 03-lighthouse-upload.mjs
// 演示：上传到 Lighthouse（IPFS + Filecoin Deal 自动建立）。
//
// 前置：在 .env 配置 LIGHTHOUSE_API_KEY
// 运行：node 03-lighthouse-upload.mjs <filepath>

import lighthouse from '@lighthouse-web3/sdk';
import 'dotenv/config';

const filePath = process.argv[2] || './sample.txt';

async function main() {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) throw new Error('请在 .env 配置 LIGHTHOUSE_API_KEY');

  // 上传文件
  const response = await lighthouse.upload(filePath, apiKey);
  const { Hash, Name, Size } = response.data;

  console.log('--- Lighthouse 上传结果 ---');
  console.log('CID:', Hash);
  console.log('文件名:', Name);
  console.log('大小:', Size, 'bytes');
  console.log('IPFS 网关:', `https://gateway.lighthouse.storage/ipfs/${Hash}`);

  // 查询 Filecoin Deal 状态（异步建立，可能需要数分钟到数小时）
  console.log('\n--- Filecoin Deal 状态查询 ---');
  console.log('  通过 lighthouse.dealStatus 接口查（实测可能延迟）');
  console.log('  或访问 https://files.lighthouse.storage 查看 dashboard');

  // 列出所有上传文件
  const uploads = await lighthouse.getUploads(apiKey);
  console.log(`\n你的账户当前有 ${uploads.data.fileList?.length || 0} 个上传`);
}

main().catch((e) => {
  console.error('上传失败:', e);
  process.exit(1);
});
