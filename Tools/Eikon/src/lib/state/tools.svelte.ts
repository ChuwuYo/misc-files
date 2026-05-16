/**
 * State for the Tools page (compression + adjustments). Independent from
 * the ID-photo editor store — different workflow, own source image.
 */
import { type Adjustments, NEUTRAL_ADJUSTMENTS } from "../core/adjust";
import type { CompressResult } from "../core/compress";

class ToolsStore {
  /** Loaded source image object URL, or null. */
  sourceUrl = $state<string | null>(null);
  sourceBytes = $state(0);

  /** Live adjustment values (preview is derived from these). */
  adj = $state<Adjustments>({ ...NEUTRAL_ADJUSTMENTS });

  /** Last compression result, for the size readout / download. */
  compressed = $state<CompressResult | null>(null);
  busy = $state(false);
  error = $state<string | null>(null);

  setSource(url: string, bytes: number) {
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = url;
    this.sourceBytes = bytes;
    this.compressed = null;
    this.adj = { ...NEUTRAL_ADJUSTMENTS };
    this.error = null;
  }

  resetAdjustments() {
    this.adj = { ...NEUTRAL_ADJUSTMENTS };
  }

  reset() {
    if (this.sourceUrl) URL.revokeObjectURL(this.sourceUrl);
    this.sourceUrl = null;
    this.sourceBytes = 0;
    this.compressed = null;
    this.adj = { ...NEUTRAL_ADJUSTMENTS };
    this.busy = false;
    this.error = null;
  }
}

export const tools = new ToolsStore();
