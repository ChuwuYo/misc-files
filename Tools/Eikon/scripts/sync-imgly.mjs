/**
 * Sync the MINIMAL @imgly background-removal assets into public/imgly/ so AI
 * cutout runs **fully offline at runtime** (publicPath → local /imgly/, no
 * CDN, images never leave the browser).
 *
 * Why fetch from the CDN here: the web package version (@imgly/
 * background-removal, e.g. 1.7.0) requests `/models/isnet_quint8`, but the
 * npm `@imgly/background-removal-data` package lags (1.4.5 → only
 * small/medium). The version-matched data lives on imgly's CDN under
 * /@imgly/background-removal-data/<webVersion>/dist/. So this is a ONE-TIME
 * build-time download of the exact matching subset; the running app still
 * loads everything locally from public/imgly/.
 *
 * public/imgly/ is gitignored (regenerate with `bun run sync:imgly`).
 * Paths are resolved relative to this file — portable across clones.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "public/imgly");

// Resolve the web package version → matching data version on the CDN.
const webPkgPath = join(
  root,
  "node_modules/@imgly/background-removal/package.json",
);
if (!existsSync(webPkgPath)) {
  console.error("✗ 缺少 @imgly/background-removal，请先 bun install");
  process.exit(1);
}
const version = JSON.parse(readFileSync(webPkgPath, "utf8")).version;
const base = `https://staticimgly.com/@imgly/background-removal-data/${version}/dist/`;

console.log(`▸ 数据版本对齐 web 包: ${version}`);
console.log(`▸ 源: ${base}`);

// Small retry so a single transient CDN hiccup doesn't abort the whole
// sync and leave public/imgly half-populated.
async function withRetry(fn, label, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries) await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  throw new Error(`${label} 失败（${tries} 次重试后）: ${lastErr}`);
}
async function getJSON(url) {
  return withRetry(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json();
  }, url);
}
async function getBuf(url) {
  return withRetry(async () => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return Buffer.from(await r.arrayBuffer());
  }, url);
}

const resources = await getJSON(`${base}resources.json`);

// Keep the quint8 model + every ONNX runtime wasm (a few MB extra, but
// guarantees offline regardless of the device's chosen backend).
const keep = Object.keys(resources).filter(
  (k) => k === "/models/isnet_quint8" || k.startsWith("/onnxruntime-web/"),
);
if (!keep.includes("/models/isnet_quint8")) {
  console.error("✗ CDN resources.json 缺少 /models/isnet_quint8");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const wanted = new Set();
let bytes = 0;
const trimmed = {};
for (const key of keep) {
  const entry = resources[key];
  if (!Array.isArray(entry?.chunks) || entry.chunks.length === 0) {
    console.error(`✗ resources.json 条目 ${key} 缺少 chunks`);
    process.exit(1);
  }
  trimmed[key] = entry;
  bytes += entry.size ?? 0;
  for (const chunk of entry.chunks) wanted.add(chunk.hash);
}

try {
  writeFileSync(join(outDir, "resources.json"), JSON.stringify(trimmed));

  let done = 0;
  for (const hash of wanted) {
    const dest = join(outDir, hash);
    // Skip only if a non-empty file already exists (a truncated chunk from
    // an interrupted run must be re-fetched, not trusted).
    if (existsSync(dest) && statSync(dest).size > 0) {
      done++;
    } else {
      const tmp = `${dest}.tmp`;
      writeFileSync(tmp, await getBuf(base + hash));
      renameSync(tmp, dest); // atomic publish
      done++;
    }
    process.stdout.write(`\r  下载分块 ${done}/${wanted.size}`);
  }

  // Completion sentinel — dev.sh gates on this, not on the dir existing.
  writeFileSync(join(outDir, ".complete"), version);
  console.log(
    `\n✓ 已同步 ${wanted.size} 个分块 (${(bytes / 1048576).toFixed(1)} MB) → public/imgly/`,
  );
} catch (err) {
  // Leave nothing half-baked: wipe so the next run re-syncs cleanly.
  rmSync(outDir, { recursive: true, force: true });
  console.error(`\n✗ 同步失败，已清理 public/imgly/：${err}`);
  process.exit(1);
}
