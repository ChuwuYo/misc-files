/**
 * Bridge between PreviewStage and CompressPanel (Tools page only).
 *
 * First-principles split: the on-screen preview runs on a DOWNSCALED proxy
 * (so dragging sliders never janks), but compression/export must use the
 * FULL source resolution. PreviewStage registers a full-resolution renderer
 * here; CompressPanel calls `renderFull()` only when the user exports.
 */
class PreviewBridge {
  /** True once a source image is loaded and a renderer is registered. */
  ready = $state(false);

  /** Set by PreviewStage: produce a full-resolution adjusted PNG Blob. */
  #fullRenderer: (() => Promise<Blob | null>) | null = null;

  registerFullRenderer(fn: (() => Promise<Blob | null>) | null) {
    this.#fullRenderer = fn;
    this.ready = fn !== null;
  }

  /** Render the adjusted image at natural resolution as a PNG Blob. */
  renderFull(): Promise<Blob | null> {
    return this.#fullRenderer ? this.#fullRenderer() : Promise.resolve(null);
  }
}

export const preview = new PreviewBridge();
