import { BACKGROUNDS, PHOTO_SPECS } from "../domain/sizes";
import type { BackgroundColor, PhotoSpec } from "../domain/types";
import type { CropperHandle } from "../core/cropper";

export type CutoutStatus = "idle" | "loading" | "running" | "done" | "error";

/**
 * Central editor state (Svelte 5 runes). UI components read/write here;
 * core/* modules consume it. Keeps panels decoupled.
 *
 * The cropper instance is owned by CropCanvas and registered here so other
 * panels (export / sheet) can drive it without direct component coupling.
 */
class EditorStore {
  /** Loaded source image as object URL, or null. */
  sourceUrl = $state<string | null>(null);
  /** Selected output spec. */
  spec = $state<PhotoSpec>(PHOTO_SPECS[0]);
  /** Chosen background (preset or custom). */
  background = $state<BackgroundColor>(BACKGROUNDS.white);
  /** Whether an AI cutout has been applied to the current source. */
  cutoutApplied = $state(false);
  /** Async status for the lazy background-removal model. */
  cutoutStatus = $state<CutoutStatus>("idle");
  /** 0..1 progress while the model loads/runs. */
  cutoutProgress = $state(0);
  /** Last user-facing error message, or null. */
  error = $state<string | null>(null);

  /** Registered by CropCanvas; null until the cropper is mounted.
   *  Reactive so consumers (export buttons) re-derive when it appears. */
  cropper = $state<CropperHandle | null>(null);

  aspectRatio = $derived(this.spec.widthPx / this.spec.heightPx);

  registerCropper(handle: CropperHandle | null) {
    this.cropper = handle;
  }

  setSource(url: string) {
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = url;
    this.cutoutApplied = false;
    this.cutoutStatus = "idle";
    this.cutoutProgress = 0;
    this.error = null;
  }

  /** Replace the source with a cutout result (already an object URL). */
  applyCutout(url: string) {
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = url;
    this.cutoutApplied = true;
    this.cutoutStatus = "done";
  }

  setSpec(spec: PhotoSpec) {
    this.spec = spec;
  }

  setBackground(bg: BackgroundColor) {
    this.background = bg;
  }

  reset() {
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = null;
    this.cutoutApplied = false;
    this.cutoutStatus = "idle";
    this.cutoutProgress = 0;
    this.error = null;
  }
}

export const editor = new EditorStore();
