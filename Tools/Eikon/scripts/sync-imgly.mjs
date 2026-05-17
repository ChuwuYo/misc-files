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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
async function getBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
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
  trimmed[key] = entry;
  bytes += entry.size ?? 0;
  for (const chunk of entry.chunks) wanted.add(chunk.hash);
}
writeFileSync(join(outDir, "resources.json"), JSON.stringify(trimmed));

let done = 0;
for (const hash of wanted) {
  const dest = join(outDir, hash);
  if (!existsSync(dest)) {
    writeFileSync(dest, await getBuf(base + hash));
  }
  process.stdout.write(`\r  下载分块 ${++done}/${wanted.size}`);
}
console.log(
  `\n✓ 已同步 ${wanted.size} 个分块 (${(bytes / 1048576).toFixed(1)} MB) → public/imgly/`,
);
