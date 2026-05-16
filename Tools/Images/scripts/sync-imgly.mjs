/**
 * Sync the MINIMAL @imgly background-removal assets into public/imgly/ so AI
 * cutout runs fully offline (no staticimgly.com CDN). We copy only what the
 * `small` (isnet_quint8) model + the ONNX runtime wasm variants need —
 * ~81 MB instead of the full 221 MB data package.
 *
 * public/imgly/ is gitignored (regenerate with `bun run sync:imgly`), so the
 * repo stays lean while the working tree is offline-capable.
 *
 * Paths are resolved relative to this file — portable across clones.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dataDist = join(root, "node_modules/@imgly/background-removal-data/dist");
const outDir = join(root, "public/imgly");

if (!existsSync(join(dataDist, "resources.json"))) {
  console.error("✗ 缺少 @imgly/background-removal-data，请先 bun install");
  process.exit(1);
}

const resources = JSON.parse(readFileSync(join(dataDist, "resources.json"), "utf8"));

// Keep the small (quint8) model + the wasm runtimes @imgly may pick at
// runtime (webgpu jsep, simd-threaded, simd fallback).
const KEEP = [
  "/models/small",
  "/onnxruntime-web/ort-wasm-simd.wasm",
  "/onnxruntime-web/ort-wasm-simd-threaded.wasm",
  "/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm",
];

mkdirSync(outDir, { recursive: true });

const wanted = new Set();
let bytes = 0;
for (const key of KEEP) {
  const entry = resources[key];
  if (!entry) {
    console.error(`✗ resources.json 缺少 ${key}`);
    process.exit(1);
  }
  bytes += entry.size;
  for (const chunk of entry.chunks) wanted.add(chunk.hash);
}

// A trimmed resources.json containing only the kept entries.
const trimmed = {};
for (const key of KEEP) trimmed[key] = resources[key];
writeFileSync(join(outDir, "resources.json"), JSON.stringify(trimmed));

for (const hash of wanted) {
  cpSync(join(dataDist, hash), join(outDir, hash));
}

console.log(
  `✓ 已同步 ${wanted.size} 个分块 (${(bytes / 1048576).toFixed(1)} MB) → public/imgly/`,
);
