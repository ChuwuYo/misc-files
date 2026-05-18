/**
 * Image compression via jSquash (Squoosh wasm codecs), lazily imported so
 * the codec wasm is only fetched when the user actually compresses.
 *
 * - PNG  → @jsquash/oxipng lossless re-encode (smaller, pixel-identical).
 * - JPEG → @jsquash/jpeg (mozjpeg) at a quality (visually lossless ≥ 90).
 */
export type CompressFormat = "png" | "jpeg";

export interface CompressResult {
  blob: Blob;
  /** Bytes before / after, for a UI ratio readout. */
  originalBytes: number;
  compressedBytes: number;
}

export interface CompressOptions {
  /** PNG: oxipng effort 0..6 (default 3). */
  pngLevel?: number;
  /** JPEG: mozjpeg quality 1..100 (default 90, "visually lossless"). */
  jpegQuality?: number;
}

type SourceKind = "png" | "jpeg";

/** Sniff the leading bytes to detect the real container, falling back to MIME. */
function sniffKind(bytes: Uint8Array, mime: string): SourceKind | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpeg";
  return null;
}

/** Losslessly (PNG) / high-quality (JPEG) re-encode an image Blob. */
export async function compressImage(
  source: Blob,
  format: CompressFormat,
  options?: CompressOptions,
): Promise<CompressResult> {
  try {
    const buffer = await source.arrayBuffer();
    const kind = sniffKind(new Uint8Array(buffer.slice(0, 4)), source.type);
    if (!kind) {
      throw new Error(`无法识别的图片格式（type="${source.type || "未知"}"，不是 PNG 或 JPEG）`);
    }

    let imageData: ImageData;
    if (kind === "png") {
      const { decode } = await import("@jsquash/png");
      imageData = await decode(buffer);
    } else {
      const { decode } = await import("@jsquash/jpeg");
      imageData = await decode(buffer);
    }

    let blob: Blob;
    if (format === "png") {
      const { optimise } = await import("@jsquash/oxipng");
      const out = await optimise(imageData, { level: options?.pngLevel ?? 3 });
      blob = new Blob([out], { type: "image/png" });
    } else {
      // JPEG has no alpha: transparent pixels would encode as black.
      // Flatten onto white first so cut-out (transparent) PNGs export
      // correctly when the user picks JPEG.
      flattenAlphaOntoWhite(imageData);
      const { encode } = await import("@jsquash/jpeg");
      const out = await encode(imageData, {
        quality: options?.jpegQuality ?? 90,
      });
      blob = new Blob([out], { type: "image/jpeg" });
    }

    return {
      blob,
      originalBytes: source.size,
      compressedBytes: blob.size,
    };
  } catch (err) {
    throw new Error(`图片压缩失败：${err instanceof Error ? err.message : String(err)}`, {
      cause: err,
    });
  }
}

/** Composite each pixel over opaque white, then set alpha to 255. */
function flattenAlphaOntoWhite(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a === 1) continue;
    d[i] = d[i] * a + 255 * (1 - a);
    d[i + 1] = d[i + 1] * a + 255 * (1 - a);
    d[i + 2] = d[i + 2] * a + 255 * (1 - a);
    d[i + 3] = 255;
  }
}
