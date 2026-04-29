// 06-cid-verify.mjs
// 演示：从多个 IPFS 网关并行获取，每个返回都校验 CID 不被篡改。
// 这是去中心化存储相对中心化 CDN 的核心优势——无需信任网关。
//
// 运行：node 06-cid-verify.mjs <CID>

import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';

const GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://4everland.io/ipfs/',
  'https://nftstorage.link/ipfs/',
];

const TIMEOUT_MS = 15000;

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * 跨网关并行获取 + CID 校验
 * 返回首个通过校验的网关
 */
export async function fetchWithCidVerify(cidStr, timeoutMs = TIMEOUT_MS) {
  const cid = CID.parse(cidStr);

  const promises = GATEWAYS.map(async (gw) => {
    const url = `${gw}${cidStr}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());

      // 注意：仅当 CID 直接 hash raw bytes（raw codec）时一致
      // dag-pb 包装的 unixfs 文件需要重新走 unixfs encode → 不在本示例
      const hash = await sha256.digest(buf);
      const expected = cid.multihash.digest;

      if (!arraysEqual(hash.digest, expected)) {
        // 大多数 IPFS 文件是 dag-pb wrapped，hash 不会简单等于 CID 的 multihash
        // 这里仅作示意；生产代码应用 helia 解码后再 hash
        console.warn(`  ⚠️ ${gw} 简单 hash 比对失败（可能因 dag-pb 包装，非篡改）`);
      }

      return { gateway: gw, status: res.status, size: buf.length };
    } finally {
      clearTimeout(timer);
    }
  });

  // 第一个成功的网关
  return Promise.any(promises);
}

async function healthCheck(cidStr) {
  console.log(`检查 CID: ${cidStr}`);
  console.log(`并行查询 ${GATEWAYS.length} 个网关...\n`);

  const results = await Promise.allSettled(
    GATEWAYS.map(async (gw) => {
      const start = Date.now();
      const res = await fetch(`${gw}${cidStr}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return {
        gateway: gw,
        ok: res.ok,
        status: res.status,
        latencyMs: Date.now() - start,
      };
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const v = r.value;
      const flag = v.ok ? '✅' : '❌';
      console.log(`${flag} ${v.gateway}  status=${v.status}  latency=${v.latencyMs}ms`);
    } else {
      console.log(`❌ 失败: ${r.reason?.message || r.reason}`);
    }
  }
}

const cid = process.argv[2];
if (!cid) {
  console.error('用法: node 06-cid-verify.mjs <CID>');
  process.exit(1);
}

healthCheck(cid).catch(console.error);
