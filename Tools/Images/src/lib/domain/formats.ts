/**
 * The format wall — single source of truth for which image files the app
 * accepts. All processing is local (browser canvas / wasm); nothing is
 * uploaded. We allow only formats that BOTH the browser can render and our
 * pipeline supports end-to-end: PNG, JPEG, WebP.
 *
 * Deliberately excluded (gated at the door with a clear message instead of
 * a late failure): HEIC/HEIF (not renderable in Chrome/Firefox), AVIF, GIF,
 * SVG, BMP, TIFF.
 */
export const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

export type AcceptedMime = (typeof ACCEPTED_MIME)[number];

/** Value for an <input type="file" accept="..."> attribute. */
export const ACCEPT_ATTR = ACCEPTED_MIME.join(",");

/** Human list for hints, e.g. "PNG / JPEG / WebP". */
export const ACCEPTED_LABEL = "PNG / JPEG / WebP";

/** Max upload size in MB, per workflow. */
export const MAX_MB = { maker: 20, tools: 30 } as const;

const EXT_RE = /\.(png|jpe?g|webp)$/i;

/**
 * Validate a picked/dropped file against the format wall.
 * Returns an error message (Chinese) to show the user, or null if OK.
 * Checks MIME first, falls back to extension when the browser reports an
 * empty type (common for drag-drop of some files).
 */
export function validateImageFile(
  file: File | null | undefined,
  workflow: keyof typeof MAX_MB,
): string | null {
  if (!file) return "未选择文件";
  const mimeOk = (ACCEPTED_MIME as readonly string[]).includes(file.type);
  const extOk = file.type === "" && EXT_RE.test(file.name);
  if (!mimeOk && !extOk) {
    return `不支持的格式，仅支持 ${ACCEPTED_LABEL}（不支持 HEIC/AVIF/GIF/SVG 等）`;
  }
  const maxBytes = MAX_MB[workflow] * 1024 * 1024;
  if (file.size > maxBytes) {
    return `图片不能超过 ${MAX_MB[workflow]} MB`;
  }
  return null;
}
