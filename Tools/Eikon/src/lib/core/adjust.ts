/**
 * Image adjustments — best-practice split by first principles:
 *
 *  - brightness / contrast / saturation / hue / grayscale → native
 *    `ctx.filter` (GPU-accelerated, instant, zero dependency).
 *  - temperature → Kelvin-based white-balance gain (own, no dependency).
 *  - sharpen → pica's configurable Unsharp Mask (mature, actively
 *    maintained, lazily loaded; replaces Photon — pica is purpose-built
 *    and lets us drop the heavier WASM dep entirely).
 *
 * The on-screen preview runs these on a downscaled proxy (see core/proxy);
 * full resolution is only used on export. So this module stays pure and
 * resolution-agnostic — callers decide the dimensions.
 */
export interface Adjustments {
  /** % — 100 = unchanged. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** degrees — 0 = unchanged. */
  hue: number;
  /** -100 (cool/blue) .. 0 .. 100 (warm/amber). */
  temperature: number;
  /** one-tap black & white. */
  grayscale: boolean;
  /** 0 = none .. 100 = strong. */
  sharpen: number;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  temperature: 0,
  grayscale: false,
  sharpen: 0,
};

/** The `CanvasRenderingContext2D.filter` string (native, GPU-accelerated). */
export function colorFilter(adj: Adjustments): string {
  return [
    `brightness(${adj.brightness}%)`,
    `contrast(${adj.contrast}%)`,
    `saturate(${adj.saturation}%)`,
    `hue-rotate(${adj.hue}deg)`,
    adj.grayscale ? "grayscale(100%)" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Kelvin → RGB (Tanner Helland approximation). Used for a proper
 * white-balance model instead of a crude R+/B- shift.
 */
function kelvinRGB(kelvin: number): [number, number, number] {
  const t = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  const c = (x: number) => Math.min(255, Math.max(0, x));
  return [c(r), c(g), c(b)];
}

/**
 * White-balance via per-channel gain relative to a neutral 6500K white
 * point. `temp` -100 (cool) .. 0 (neutral) .. 100 (warm). Multiplicative
 * (not additive) so highlights/skin shift naturally. Pure O(n).
 */
function applyTemperature(ctx: CanvasRenderingContext2D, w: number, h: number, temp: number) {
  if (temp === 0) return;
  // Warmer = lower Kelvin (more red). Map ±100 → 6500K ∓ 3000K.
  const kelvin = 6500 - (temp / 100) * 3000;
  const [tr, tg, tb] = kelvinRGB(kelvin);
  const [nr, ng, nb] = kelvinRGB(6500);
  // Normalize so the largest channel gain is 1 — temperature shifts the
  // color balance without darkening the image (the warm half otherwise
  // only attenuates G/B, dimming the result).
  const g0 = tr / nr;
  const g1 = tg / ng;
  const g2 = tb / nb;
  const gmax = Math.max(g0, g1, g2) || 1;
  const gr = g0 / gmax;
  const gg = g1 / gmax;
  const gb = g2 / gmax;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i] * gr);
    d[i + 1] = Math.min(255, d[i + 1] * gg);
    d[i + 2] = Math.min(255, d[i + 2] * gb);
  }
  ctx.putImageData(img, 0, 0);
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

  applyTemperature(ctx, canvas.width, canvas.height, adj.temperature);

  return canvas;
}

/**
 * Lazily-created pica instance (own chunk; never in the main bundle).
 * pica's resize pipeline applies a high-quality, configurable Unsharp
 * Mask — far better than a fixed 3x3 convolution, with real radius +
 * threshold (threshold protects skin/flat areas from noise).
 */
let picaInstance: import("pica").Pica | null = null;

async function getPica(): Promise<import("pica").Pica> {
  if (!picaInstance) {
    const { default: pica } = await import("pica");
    picaInstance = pica();
  }
  return picaInstance;
}

/**
 * Sharpen a canvas in place via pica's Unsharp Mask. No-op when
 * `sharpen <= 0`. `sharpen` is the 0..100 UI value, mapped to pica's
 * `unsharpAmount` with a sensible fixed radius/threshold.
 */
export async function sharpenInPlace(canvas: HTMLCanvasElement, sharpen: number): Promise<void> {
  if (sharpen <= 0) return;
  if (canvas.width === 0 || canvas.height === 0) return;

  const p = await getPica();

  // Same-size "resize" runs the pipeline (incl. unsharp) without scaling.
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;

  await p.resize(canvas, out, {
    unsharpAmount: Math.round(sharpen * 2), // 0..200 (pica scale 0..500)
    unsharpRadius: 0.6,
    unsharpThreshold: 2,
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("sharpenInPlace: 无法获取 2D 渲染上下文 (canvas 2d context)");
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(out, 0, 0);
}

/**
 * Full adjusted render: `applyColor` then `sharpenInPlace`. Used for the
 * full-resolution export path (compression). Async because of pica.
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
    // already applied to `c`. If the sharpen pass fails, we degrade
    // gracefully — return the color-adjusted canvas
    // without sharpening rather than failing the whole render. The error
    // is logged for diagnostics. Callers that need strict sharpening
    // should call `sharpenInPlace` directly and handle its rejection.
    console.error("renderAdjusted: 锐化失败，返回仅颜色调整的结果", err);
  }
  return c;
}
