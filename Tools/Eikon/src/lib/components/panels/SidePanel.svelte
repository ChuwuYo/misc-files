<script lang="ts">
import ColorPicker from "svelte-awesome-color-picker";
import ColorTrigger from "../ui/ColorTrigger.svelte";
import Panel from "../ui/Panel.svelte";
import Button from "../ui/Button.svelte";
import { BACKGROUNDS } from "../../domain/sizes";
import { isSheetEligible } from "../../domain/sizes";
import { editor } from "../../state/editor.svelte";
import type { BackgroundPreset } from "../../domain/types";
import {
  exportPhoto as pipelineExportPhoto,
  exportSheet as pipelineExportSheet,
} from "../../core/pipeline";

const swatches: BackgroundPreset[] = ["white", "blue", "red"];

let format = $state<"image/jpeg" | "image/png">("image/jpeg");

const customHex = $derived(
  editor.background.preset === "custom" ? editor.background.hex : "#000000",
);

const noCropper = $derived(!editor.cropper);
const sheetDisabled = $derived(noCropper || !isSheetEligible(editor.spec));

function pickPreset(p: BackgroundPreset) {
  editor.setBackground(BACKGROUNDS[p]);
}

function pickCustom(color: { hex?: string | null }) {
  if (color.hex) editor.setBackground({ preset: "custom", hex: color.hex });
}

async function exportPhoto() {
  if (!editor.cropper) return;
  editor.error = null;
  try {
    await pipelineExportPhoto(editor.cropper, editor.spec, editor.background, format);
  } catch (err) {
    editor.error = err instanceof Error ? err.message : "导出失败";
  }
}

async function exportSheet() {
  if (!editor.cropper) return;
  editor.error = null;
  try {
    await pipelineExportSheet(editor.cropper, editor.spec, editor.background);
  } catch (err) {
    editor.error = err instanceof Error ? err.message : "排版生成失败";
  }
}
</script>

<Panel label="④ 背景 / 导出">
  <div class="sw">
    {#each swatches as p (p)}
      <button
        class="dot"
        class:sel={editor.background.preset === p}
        style:background={BACKGROUNDS[p].hex}
        aria-label={p}
        onclick={() => pickPreset(p)}
      ></button>
    {/each}
    <div
      class="custom"
      class:sel={editor.background.preset === "custom"}
      title="自定义背景色"
    >
      <ColorPicker
        hex={customHex}
        label="自定义"
        position="responsive"
        isAlpha={false}
        components={{ input: ColorTrigger }}
        onInput={pickCustom}
      />
    </div>
  </div>

  <div class="fmt" role="radiogroup" aria-label="导出格式">
    <button
      class="seg"
      class:on={format === "image/jpeg"}
      onclick={() => (format = "image/jpeg")}
    >JPG</button>
    <button
      class="seg"
      class:on={format === "image/png"}
      onclick={() => (format = "image/png")}
    >PNG</button>
  </div>

  <div class="actions">
    <Button onclick={exportPhoto} disabled={noCropper}>导出当前照片</Button>
    <Button variant="ghost" onclick={exportSheet} disabled={sheetDisabled}>
      生成六寸排版
    </Button>
  </div>

  {#if editor.error}
    <p class="err" role="alert">{editor.error}</p>
  {/if}
</Panel>

<style>
  .sw {
    display: flex;
    gap: var(--sp-xs);
    align-items: center;
    margin-bottom: var(--sp-md);
  }
  .dot {
    width: 32px;
    height: 32px;
    border-radius: var(--r-full);
    border: 1px solid var(--c-hairline);
    cursor: pointer;
  }
  .dot.sel {
    box-shadow: 0 0 0 2px var(--c-accent);
  }
  /* Custom color via svelte-awesome-color-picker (modern, maintained,
     Svelte-native). Themed to DESIGN.md tokens through the library's
     CSS custom properties; popup not the bare OS dialog. */
  .custom {
    display: flex;
    align-items: center;
    /* library popup theme */
    --cp-bg-color: var(--c-surface-1);
    --cp-border-color: var(--c-hairline);
    --cp-text-color: var(--c-ink);
    --cp-input-color: var(--c-surface-2);
    /* Not --c-accent: in dark theme accent is #fff, which made the
       hex/HSV toggle button white-on-white on hover. A surface-tinted
       mix stays visible and keeps the (unchanged) text readable in both
       themes. */
    --cp-button-hover-color: color-mix(in srgb, var(--c-accent) 20%, var(--c-surface-2));
  }
  /* Trigger is our ColorTrigger (pill). Selected-state ring on it. */
  .custom.sel :global(.trigger) {
    box-shadow: 0 0 0 2px var(--c-accent);
  }
  .custom :global(.color-picker .text-input) {
    color: var(--c-ink);
  }
  .fmt {
    display: flex;
    gap: var(--sp-xs);
    margin-bottom: var(--sp-md);
  }
  .seg {
    flex: 1;
    padding: var(--sp-xs);
    border-radius: var(--r-md);
    border: 1px solid var(--c-hairline);
    background: var(--c-surface-1);
    color: var(--c-soft);
    cursor: pointer;
  }
  .seg.on {
    color: var(--c-ink);
    border-color: var(--c-accent);
    box-shadow: 0 0 0 1px var(--c-accent);
  }
  .actions {
    display: grid;
    gap: var(--sp-xs);
  }
  .err {
    margin: var(--sp-sm) 0 0;
    font-size: var(--t-body-sm-size);
    color: var(--c-danger);
  }
</style>
