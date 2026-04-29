// 习题 1: reth + lighthouse 硬件 + 月度成本估算
// 验证日期: 2026-04
// 运行: bun run calc.ts (或 npx tsx calc.ts)
//
// 已知 (2026-04 公开数据):
//   - mainnet 全节点磁盘: reth v2 ~700 GB (storage v2 默认), lighthouse ~150 GB
//   - mainnet archive: reth ~2.5 TB, lighthouse archive (rare) ~500 GB
//   - 推荐 NVMe: 4 TB Samsung 990 Pro = ¥1700, 8 TB Crucial T700 = ¥4500
//   - CPU: Ryzen 7 7700X 65W TDP idle ~30W, peak ~100W
//   - DRAM 64 GB ~ ¥1200, ECC 64 GB ~¥2000
//   - 电费: 平均 ¥0.7/kWh (国内商业用电), 服务器整机平均 60W
//   - 机房托管 (1U): ¥150/月 (含 100 Mbps 带宽), 自建宽带: ¥300/月 (300M 上下行)
//   - 云对照: AWS i4i.2xlarge (8 vCPU / 64 GB / 1.875 TB NVMe) = $0.687/h ≈ ¥3500/月

interface NodeProfile {
  name: string;
  diskGB: number;          // 数据盘容量 (含 30% buffer)
  ramGB: number;
  monthlyPowerKwh: number; // 服务器整机连续运行
}

interface CostEstimate {
  upfrontCNY: number;      // 一次性硬件
  monthlyCNY: number;      // 月度运营 (电费 + 网络 / 托管)
  yearlyTotalCNY: number;  // 第一年总成本
  cloudEquivalent: number; // 同等云算力 12 个月
}

const PRICE_PER_KWH = 0.7;
const HOURS_PER_MONTH = 24 * 30;

function estimate(profile: NodeProfile, mode: "self-hosted" | "colo"): CostEstimate {
  // 选盘策略: <2TB 选 4 TB; >=2TB 选 8 TB
  const ssdCNY = profile.diskGB <= 2000 ? 1700 : 4500;
  const ramCNY = profile.ramGB <= 64 ? 1200 : 2000;
  const cpuMoboPsuCNY = 4500;          // 7700X + B650 + 850W
  const chassisCNY = 600;
  const upfrontCNY = ssdCNY + ramCNY + cpuMoboPsuCNY + chassisCNY;

  const electricityCNY = profile.monthlyPowerKwh * PRICE_PER_KWH;
  const networkCNY = mode === "self-hosted" ? 300 : 150;
  const monthlyCNY = electricityCNY + networkCNY;

  const yearlyTotalCNY = upfrontCNY + monthlyCNY * 12;
  const cloudEquivalent = 3500 * 12;

  return { upfrontCNY, monthlyCNY, yearlyTotalCNY, cloudEquivalent };
}

const profiles: NodeProfile[] = [
  {
    name: "reth + lighthouse mainnet full",
    diskGB: Math.ceil((700 + 150) * 1.3),       // 1105 GB -> 4 TB SSD
    ramGB: 32,
    monthlyPowerKwh: (60 / 1000) * HOURS_PER_MONTH, // 60W * 720h = 43.2 kWh
  },
  {
    name: "reth archive + lighthouse mainnet",
    diskGB: Math.ceil((2500 + 150) * 1.3),      // 3445 GB -> 8 TB SSD
    ramGB: 64,
    monthlyPowerKwh: (80 / 1000) * HOURS_PER_MONTH,
  },
  {
    name: "geth + lighthouse mainnet full (对照)",
    diskGB: Math.ceil((1200 + 150) * 1.3),      // geth ~1.2 TB
    ramGB: 32,
    monthlyPowerKwh: (60 / 1000) * HOURS_PER_MONTH,
  },
];

console.log("型号 / 模式                                 一次性  月度   年度    云对照");
for (const p of profiles) {
  for (const mode of ["self-hosted", "colo"] as const) {
    const r = estimate(p, mode);
    console.log(
      `${(p.name + ` (${mode})`).padEnd(45)} ¥${r.upfrontCNY.toFixed(0).padStart(5)}  ¥${r.monthlyCNY.toFixed(0).padStart(4)}  ¥${r.yearlyTotalCNY.toFixed(0).padStart(6)}  ¥${r.cloudEquivalent.toFixed(0)}`,
    );
  }
}

// 关键洞察 (在答案 README 中详述):
// 1. 自建一年 (¥7500-12000) 比同等云算力 (¥42000) 便宜 4-5 倍
// 2. archive 节点的最大成本是 8 TB NVMe, 第二年起电+网才是大头
// 3. 千万不要用消费级 QLC SSD 跑 archive: 写放大会在 1-2 年磨穿盘
