/**
 * AI background removal. Lazily imports @imgly/background-removal so the
 * ~40MB model is only fetched when the user actually requests a cutout.
 */

type ImglyConfig = {
  publicPath?: string;
  debug?: boolean;
  device?: "cpu" | "gpu";
  model?: "isnet" | "isnet_fp16" | "isnet_quint8";
  output?: {
    format?: "image/png" | "image/jpeg" | "image/webp";
    quality?: number;
    type?: "foreground" | "background" | "mask";
  };
  progress?: (key: string, current: number, total: number) => void;
};

type ImglyRemoveBackground = (src: Blob, config?: ImglyConfig) => Promise<Blob>;

/**
 * Remove the background from an image and return a transparent PNG.
 *
 * @param source     Source image blob.
 * @param onProgress Optional progress callback, invoked with a 0..1 ratio.
 * @returns          A PNG blob containing the cut-out foreground.
 */
export async function removeBackground(
  source: Blob,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  let imglyRemoveBackground: ImglyRemoveBackground;
  try {
    const mod = (await import("@imgly/background-removal")) as unknown as {
      default?: ImglyRemoveBackground;
      removeBackground?: ImglyRemoveBackground;
    };
    imglyRemoveBackground = (mod.default ?? mod.removeBackground) as ImglyRemoveBackground;
  } catch (cause) {
    throw new Error("无法加载背景移除模块（@imgly/background-removal）。", { cause });
  }

  if (typeof imglyRemoveBackground !== "function") {
    throw new Error("背景移除模块加载异常：未找到可调用的入口。");
  }

  const config: ImglyConfig = {
    // Self-hosted model + ORT runtime under public/imgly/ — fully offline,
    // no staticimgly.com CDN. Synced via `bun run sync:imgly`.
    publicPath: new URL("imgly/", document.baseURI).href,
    // Small quantized model (~40MB).
    model: "isnet_quint8",
    // Prefer WebGPU; the library falls back to CPU/WASM when GPU is
    // unavailable, so no extra handling is required here.
    device: "gpu",
    output: { format: "image/png", type: "foreground" },
  };

  if (onProgress) {
    config.progress = (_key, current, total) => {
      const ratio = total > 0 ? current / total : 0;
      // Clamp into 0..1 to guard against any out-of-range values.
      onProgress(Math.min(1, Math.max(0, ratio)));
    };
  }

  try {
    return await imglyRemoveBackground(source, config);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`背景移除失败：${detail}`, { cause });
  }
}
