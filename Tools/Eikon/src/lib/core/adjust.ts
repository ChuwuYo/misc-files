/**
 * Image adjustments — best-practice split by first principles:
 *
 *  - brightness / contrast / saturation → native `ctx.filter`
 *    (GPU-accelerated, instant, zero dependency — the platform does this
 *    best, so we don't add a library for it).
 *  - sharpen → Photon (Rust→WASM), lazily initialized, native-speed
 *    convolution instead of a hand-written JS loop (the real jank source).
 *
 * The on-screen preview runs these on a downscaled proxy (see core/proxy);
 * full resolution is only used on export. So this module stays pure and
 * resolution-agnostic — callers decide the dimensions.
 *
 * STUB: signatures are frozen; bodies filled by the implementation agent.
 */
export interface Adjustments {
  /** % — 100 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** 0 = none .. 100 = strong. */
  sharpen: number;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpen: 0,
};

/** The `CanvasRenderingContext2D.filter` string for color adjustments. */
export function colorFilter(adj: Adjustments): string {
  return `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;
}

/**
 * Draw `source` at `width`×`height` applying ONLY color adjustments
 * (brightness/contrast/saturation) via native ctx.filter. Synchronous and
 * cheap — safe to call on every slider tick (on a proxy-sized canvas).
 */
export function applyColor(
  source: CanvasImageSource,
  width: number,
  height: number,
  adj: Adjustments,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("applyColor: 无法获取 2D 渲染上下文 (canvas 2d context)");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // At NEUTRAL_ADJUSTMENTS this filter is the identity, so the draw is a
  // faithful pixel copy.
  ctx.filter = colorFilter(adj);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";

  return canvas;
}

/**
 * Cached Photon WASM init promise. Photon's web build exposes a default
 * export that initializes the WASM module; it must run exactly once. We
 * memoize the promise so repeated `sharpenInPlace` calls don't re-init.
 */
let photonInit: Promise<unknown> | null = null;

async function loadPhoton(): Promise<typeof import("@silvia-odwyer/photon")> {
  // Lazy import — keeps Photon in its own chunk, never in the main bundle.
  const photon = await import("@silvia-odwyer/photon");
  if (!photonInit) {
    // Cache the init *promise* (not just a boolean) so concurrent callers
    // all await the same single initialization.
    photonInit = Promise.resolve(photon.default());
  }
  await photonInit;
  return photon;
}

/**
 * Sharpen a canvas in place using Photon (WASM, lazily imported on first
 * use). No-op when `sharpen <= 0`. `sharpen` is the 0..100 UI value.
 */
export async function sharpenInPlace(canvas: HTMLCanvasElement, sharpen: number): Promise<void> {
  if (sharpen <= 0) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("sharpenInPlace: 无法获取 2D 渲染上下文 (canvas 2d context)");
  }

  // Snapshot the un-sharpened pixels so we can blend by intensity.
  // Photon's `sharpen` is a fixed 3x3 convolution with no strength knob,
  // so we treat `sharpen/100` as an opacity: 0 = original, 100 = full
  // Photon sharpen. This makes the 0..100 UI value continuously control
  // the visible effect.
  const original = document.createElement("canvas");
  original.width = canvas.width;
  original.height = canvas.height;
  const oCtx = original.getContext("2d");
  if (!oCtx) {
    throw new Error("sharpenInPlace: 无法创建混合用 canvas 上下文");
  }
  oCtx.drawImage(canvas, 0, 0);

  let photon: typeof import("@silvia-odwyer/photon");
  try {
    photon = await loadPhoton();
  } catch (err) {
    throw new Error("Photon WASM 初始化失败，无法应用锐化", { cause: err });
  }

  try {
    const pi = photon.open_image(canvas, ctx);
    photon.sharpen(pi);
    photon.putImageData(canvas, ctx, pi);

    const amount = Math.min(1, Math.max(0, sharpen / 100));
    if (amount < 1) {
      // canvas currently holds the fully-sharpened result. Composite the
      // original on top at (1 - amount) opacity to lerp back toward it.
      ctx.save();
      ctx.globalAlpha = 1 - amount;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(original, 0, 0);
      ctx.restore();
    }
  } catch (err) {
    throw new Error("Photon 锐化处理失败", { cause: err });
  }
}

/**
 * Full adjusted render: `applyColor` then `sharpenInPlace`. Used for the
 * full-resolution export path (compression). Async because of Photon.
 */
export async function renderAdjusted(
  source: CanvasImageSource,
  width: number,
  height: number,
  adj: Adjustments,
): Promise<HTMLCanvasElement> {
  const c = applyColor(source, width, height, adj);
  try {
    await sharpenInPlace(c, adj.sharpen);
  } catch (err) {
    // Design choice: color adjustment is the essential output and is
    // already applied to `c`. If Photon (WASM init or the sharpen pass)
    // fails, we degrade gracefully — return the color-adjusted canvas
    // without sharpening rather than failing the whole render. The error
    // is logged for diagnostics. Callers that need strict sharpening
    // should call `sharpenInPlace` directly and handle its rejection.
    console.error("renderAdjusted: 锐化失败，返回仅颜色调整的结果", err);
  }
  return c;
}
