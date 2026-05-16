/**
 * Cropper.js v2 wrapper. Owns the cropper-canvas lifecycle and exposes a
 * single `renderTo(spec, bg)` that yields a print-sized canvas.
 */
import Cropper from "cropperjs";
import type { BackgroundColor, PhotoSpec } from "../domain/types";

/** Minimal structural typings for the Cropper.js v2 web-component elements. */
interface CropperImageEl extends HTMLElement {
  $rotate(angle: string | number): unknown;
  $zoom(scale: number): unknown;
  $center(size?: "contain" | "cover"): unknown;
  $resetTransform(): unknown;
}

interface CropperSelectionEl extends HTMLElement {
  aspectRatio: number;
  $center(): unknown;
  $reset(): unknown;
  $change(x: number, y: number, width: number, height: number, aspectRatio?: number): unknown;
  $toCanvas(options?: { width?: number; height?: number }): Promise<HTMLCanvasElement>;
}

interface SelectionChangeEvent extends CustomEvent {
  detail: { x: number; y: number; width: number; height: number };
}

const TEMPLATE = `
<cropper-canvas background style="width: 100%; height: 100%;">
  <cropper-image rotatable scalable skewable translatable></cropper-image>
  <cropper-shade hidden></cropper-shade>
  <cropper-handle action="select" plain></cropper-handle>
  <cropper-selection movable resizable initial-coverage="0.8">
    <cropper-grid role="grid" covered></cropper-grid>
    <cropper-crosshair centered></cropper-crosshair>
    <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
    <cropper-handle action="n-resize"></cropper-handle>
    <cropper-handle action="e-resize"></cropper-handle>
    <cropper-handle action="s-resize"></cropper-handle>
    <cropper-handle action="w-resize"></cropper-handle>
    <cropper-handle action="ne-resize"></cropper-handle>
    <cropper-handle action="nw-resize"></cropper-handle>
    <cropper-handle action="se-resize"></cropper-handle>
    <cropper-handle action="sw-resize"></cropper-handle>
  </cropper-selection>
</cropper-canvas>
`;

export function createCropper(container: HTMLElement): CropperHandle {
  let cropper: Cropper | null = null;
  let aspectRatio = NaN;

  function getImage(): CropperImageEl | null {
    return (cropper?.getCropperImage() as CropperImageEl | null) ?? null;
  }

  function getSelection(): CropperSelectionEl | null {
    return (cropper?.getCropperSelection() as CropperSelectionEl | null) ?? null;
  }

  function getCanvas(): HTMLElement | null {
    return (cropper?.getCropperCanvas() as HTMLElement | null) ?? null;
  }

  // Keep the selection inside the canvas. Cropper.js v2 has no built-in
  // clamp; its documented `preventDefault` approach freezes the box at the
  // edge. Instead we cancel the out-of-bounds change and immediately apply a
  // corrected rectangle so the box slides smoothly along the boundary.
  // `clamping` guards against the $change re-entering this handler.
  let clamping = false;
  function clampSelection(event: Event): void {
    if (clamping) return;
    const canvas = getCanvas();
    const selection = getSelection();
    if (!canvas || !selection) return;

    const { x, y, width, height } = (event as SelectionChangeEvent).detail;
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;

    // Already inside — let it through untouched (no jank on normal moves).
    if (x >= 0 && y >= 0 && x + width <= cw && y + height <= ch) return;

    event.preventDefault();

    // Shrink to fit the canvas, preserving the locked aspect ratio if any.
    let w = Math.min(width, cw);
    let h = Math.min(height, ch);
    const ar = aspectRatio;
    if (Number.isFinite(ar) && ar > 0) {
      if (w / h > ar) w = h * ar;
      else h = w / ar;
      if (w > cw) {
        w = cw;
        h = w / ar;
      }
      if (h > ch) {
        h = ch;
        w = h * ar;
      }
    }

    // Slide the position back inside (clamp into [0, canvas - size]).
    const nx = Math.min(Math.max(0, x), cw - w);
    const ny = Math.min(Math.max(0, y), ch - h);

    clamping = true;
    selection.$change(nx, ny, w, h, Number.isFinite(ar) ? ar : Number.NaN);
    clamping = false;
  }

  return {
    mount(image: HTMLImageElement): void {
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
      container.replaceChildren();
      cropper = new Cropper(image, { container, template: TEMPLATE });

      const selection = getSelection();
      if (selection) {
        if (Number.isFinite(aspectRatio)) {
          selection.aspectRatio = aspectRatio;
        }
        selection.addEventListener("change", clampSelection);
      }

      // Fit the image to the canvas once layout is settled. Without this the
      // cropper-canvas can render at the image's intrinsic size (tiny) and
      // leave the container mostly empty.
      requestAnimationFrame(() => {
        getImage()?.$center("contain");
        getSelection()?.$center();
      });
    },

    setAspectRatio(ratio: number): void {
      aspectRatio = ratio;
      const selection = getSelection();
      if (selection) {
        selection.aspectRatio = ratio;
      }
    },

    rotate(deg: number): void {
      getImage()?.$rotate(`${deg}deg`);
    },

    zoom(delta: number): void {
      getImage()?.$zoom(delta);
    },

    recenter(): void {
      getImage()?.$center("contain");
      getSelection()?.$center();
    },

    reset(): void {
      // Return to the initial *fitted* state, not the raw transform:
      // $resetTransform alone restores the image's intrinsic (often huge)
      // size; re-fit it to the canvas like on mount.
      const image = getImage();
      image?.$resetTransform();
      image?.$center("contain");
      getSelection()?.$reset();
      getSelection()?.$center();
    },

    async renderTo(spec: PhotoSpec, bg: BackgroundColor): Promise<HTMLCanvasElement> {
      const selection = getSelection();
      if (!selection) {
        throw new Error("Cropper not mounted: no selection available.");
      }

      const cropped = await selection.$toCanvas({
        width: spec.widthPx,
        height: spec.heightPx,
      });

      if (bg.hex === "transparent") {
        return cropped;
      }

      const out = document.createElement("canvas");
      out.width = spec.widthPx;
      out.height = spec.heightPx;
      const ctx = out.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to acquire 2D context for compositing.");
      }
      ctx.fillStyle = bg.hex;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(cropped, 0, 0, out.width, out.height);
      return out;
    },

    destroy(): void {
      if (cropper) {
        cropper.destroy();
        cropper = null;
      }
      container.replaceChildren();
    },
  };
}

export interface CropperHandle {
  mount(image: HTMLImageElement): void;
  setAspectRatio(ratio: number): void;
  rotate(deg: number): void;
  zoom(delta: number): void;
  recenter(): void;
  reset(): void;
  /** Render the selection at the spec's pixel size, compositing the bg. */
  renderTo(spec: PhotoSpec, bg: BackgroundColor): Promise<HTMLCanvasElement>;
  destroy(): void;
}
