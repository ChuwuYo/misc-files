// health-check.mjs
// 生产环境每日健康检查：关键 CID 在多个网关是否还能访问。
// 任何失败 → 通过 Webhook 告警。
//
// 运行：node health-check.mjs
// 推荐：crontab 每天跑 1 次

const CRITICAL_CIDS = [
  // 替换为你项目的关键 CID
  // { label: 'NFT base metadata', cid: 'bafybeig...' },
  // { label: 'DAO archive Q1 2026', cid: 'bafkreid...' },
];

const GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

const TIMEOUT_MS = 30000;

async function checkOne(label, cid) {
  const startedAt = Date.now();
  const checks = await Promise.allSettled(
    GATEWAYS.map(async (gw) => {
      const start = Date.now();
      const res = await fetch(`${gw}${cid}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return { gw, ok: res.ok, status: res.status, latencyMs: Date.now() - start };
    }),
  );

  const success = checks.filter((c) => c.status === 'fulfilled' && c.value.ok);
  const failed = checks.length - success.length;
  return {
    label,
    cid,
    successCount: success.length,
    failedCount: failed,
    totalLatencyMs: Date.now() - startedAt,
    healthy: success.length >= 2,  // 至少 2 个网关返回算健康
    details: checks.map((c) => c.status === 'fulfilled' ? c.value : { error: c.reason?.message }),
  };
}

async function notify(failures) {
  // 替换为你的 Slack / Telegram / PagerDuty webhook
  const webhook = process.env.ALERT_WEBHOOK;
  if (!webhook) {
    console.error('⚠️ 未配置 ALERT_WEBHOOK，仅打印失败');
    failures.forEach((f) => console.error(f));
    return;
  }
  await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 IPFS 健康检查告警\n${JSON.stringify(failures, null, 2)}`,
    }),
  });
}

async function main() {
  if (CRITICAL_CIDS.length === 0) {
    console.log('未配置关键 CID 列表，请编辑此文件 CRITICAL_CIDS');
    process.exit(0);
  }

  const results = await Promise.all(
    CRITICAL_CIDS.map(({ label, cid }) => checkOne(label, cid)),
  );

  const failures = results.filter((r) => !r.healthy);
  console.log(JSON.stringify(results, null, 2));

  if (failures.length > 0) {
    await notify(failures);
    process.exit(1);
  }
  console.log('\n✅ 全部 CID 健康');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
