/**
 * Live-preview adjustment orchestration. Keeps the proxy → color →
 * debounced-async-sharpen sequencing (with stale-run guarding) out of the
 * Svelte component, mirroring how `pipeline.ts` keeps export sequencing out
 * of components. Konva/UI-agnostic: the caller supplies an `onFrame`
 * callback that receives the canvas to display.
 */
import type { Adjustments } from "./adjust";
import { applyColor, sharpenInPlace } from "./adjust";
import type { Proxy } from "./proxy";

export interface AdjustRunner {
  /** Apply color instantly (onFrame), then debounce the WASM sharpen pass. */
  run(proxy: Proxy, adj: Adjustments, onFrame: (c: HTMLCanvasElement) => void): void;
  /** Cancel any pending sharpen and invalidate in-flight runs. */
  dispose(): void;
}

export function createAdjustRunner(debounceMs = 120): AdjustRunner {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Monotonic token: a newer run() invalidates an older async sharpen.
  let gen = 0;

  return {
    run(proxy, adj, onFrame) {
      const color = applyColor(proxy.canvas, proxy.width, proxy.height, adj);
      onFrame(color);

      const current = ++gen;
      if (timer) clearTimeout(timer);
      if (adj.sharpen <= 0) return;

      timer = setTimeout(async () => {
        const sharp = document.createElement("canvas");
        sharp.width = color.width;
        sharp.height = color.height;
        sharp.getContext("2d")?.drawImage(color, 0, 0);
        await sharpenInPlace(sharp, adj.sharpen);
        if (current !== gen) return; // superseded
        onFrame(sharp);
      }, debounceMs);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      gen++;
    },
  };
}
