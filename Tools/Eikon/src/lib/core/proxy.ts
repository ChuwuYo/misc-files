/**
 * Downscaled preview proxy. The single biggest perf win for live editing:
 * compute adjustments on a small copy (long edge ≤ maxEdge) so the main
 * thread never chokes on a 24-megapixel source while a slider is dragged.
 * Full resolution is reserved for export only.
 */
export interface Proxy {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** proxyEdge / sourceEdge (≤ 1). 1 when the source is already small. */
  scale: number;
}

export function createProxy(source: HTMLImageElement, maxEdge = 1600): Proxy {
  const sw = source.naturalWidth;
  const sh = source.naturalHeight;
  const longest = Math.max(sw, sh);
  // ≤ 1: never upscale. 1 when the source already fits within maxEdge.
  const scale = longest > 0 ? Math.min(1, maxEdge / longest) : 1;

  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createProxy: 无法获取 2D 渲染上下文 (canvas 2d context)");
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Always draw — even at scale 1 we return an independent canvas copy.
  ctx.drawImage(source, 0, 0, width, height);

  return { canvas, width, height, scale };
}
