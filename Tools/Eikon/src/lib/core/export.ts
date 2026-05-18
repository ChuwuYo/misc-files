/** Canvas → file. Triggers a browser download as JPG or PNG. */
import { JPEG_FALLBACK_BG } from "../domain/constants";
import { compositeOver } from "./canvas";

export type ExportFormat = "image/jpeg" | "image/png";

/**
 * Encode a canvas and trigger a download.
 *
 * JPEG cannot store alpha: transparent pixels would encode as black. When
 * `format` is JPEG the canvas is first flattened onto `opaqueBg` so a
 * cut-out (transparent) photo exports correctly.
 */
export async function exportCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  format: ExportFormat = "image/jpeg",
  quality = 0.95,
  opaqueBg: string = JPEG_FALLBACK_BG,
): Promise<void> {
  const target = format === "image/jpeg" ? compositeOver(canvas, opaqueBg) : canvas;
  const blob = await new Promise<Blob | null>((res) => target.toBlob(res, format, quality));
  if (!blob) throw new Error("Canvas export failed.");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Defer revoke: Firefox needs the URL alive past the click tick.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
