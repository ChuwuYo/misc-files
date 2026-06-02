#!/usr/bin/env node
/**
 * Self-host MediaPipe Tasks Vision runtime + Selfie Segmenter model.
 *
 * Phase 0 Gate (ADR 2026-06-02). Pulls WASM (SIMD + nosimd variants) plus the
 * selfie_segmenter.tflite portrait model into public/mediapipe/. Replaces the
 * old @imgly version-coupling hack with a flat URL list.
 *
 * Run:  bun scripts/sync-mediapipe.mjs
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_VERSION = "0.10.35";
const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const OUT_ROOT = join(ROOT, "public", "mediapipe");

const CDN_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${PKG_VERSION}`;
const MODEL_BASE = "https://storage.googleapis.com/mediapipe-models/image_segmenter";

const TARGETS = [
  // WASM runtime (SIMD)
  [`${CDN_BASE}/wasm/vision_wasm_internal.js`, "wasm/vision_wasm_internal.js"],
  [`${CDN_BASE}/wasm/vision_wasm_internal.wasm`, "wasm/vision_wasm_internal.wasm"],
  // WASM runtime (no-SIMD fallback for older browsers)
  [`${CDN_BASE}/wasm/vision_wasm_nosimd_internal.js`, "wasm/vision_wasm_nosimd_internal.js"],
  [`${CDN_BASE}/wasm/vision_wasm_nosimd_internal.wasm`, "wasm/vision_wasm_nosimd_internal.wasm"],
  // Selfie Segmenter model (person / background, 244 KB)
  [`${MODEL_BASE}/selfie_segmenter/float16/latest/selfie_segmenter.tflite`,
   "models/selfie_segmenter.tflite"],
];

const fmt = (n) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;

async function fetchTo(url, destRel) {
  const dest = join(OUT_ROOT, destRel);
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  ✔ ${destRel.padEnd(48)} ${fmt(buf.byteLength).padStart(12)}`);
  return buf.byteLength;
}

console.log(`Syncing MediaPipe Tasks Vision @ ${PKG_VERSION} → public/mediapipe/`);
let total = 0;
for (const [url, dest] of TARGETS) total += await fetchTo(url, dest);
console.log(`Done. Total: ${fmt(total)}`);
