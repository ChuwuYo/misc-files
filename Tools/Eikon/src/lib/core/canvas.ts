/** Shared canvas 2D helpers — single implementation for the repeated
 *  "create canvas / get ctx or throw / composite over solid bg" pattern. */

/** Get a 2D context or throw a clear, uniform error. */
export function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法获取 2D 渲染上下文 (canvas 2d context)");
  return ctx;
}

/**
 * Composite `src` over an opaque `bg` color, returning a NEW canvas of the
 * same pixel size. Used wherever a (possibly transparent) image must become
 * opaque (cropper background, JPEG export fallback).
 */
export function compositeOver(src: HTMLCanvasElement, bg: string): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = ctx2d(out);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0);
  return out;
}
