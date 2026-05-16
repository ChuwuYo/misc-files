<script lang="ts">
import IconPen from "~icons/iconamoon/pen";
import Panel from "../ui/Panel.svelte";
import Button from "../ui/Button.svelte";
import { BACKGROUNDS } from "../../domain/sizes";
import { isSheetEligible } from "../../domain/sizes";
import { editor } from "../../state/editor.svelte";
import type { BackgroundPreset } from "../../domain/types";
import { removeBackground } from "../../core/background";
import {
  exportPhoto as pipelineExportPhoto,
  exportSheet as pipelineExportSheet,
} from "../../core/pipeline";

const swatches: BackgroundPreset[] = ["white", "blue", "red"];

let format = $state<"image/jpeg" | "image/png">("image/jpeg");

const customHex = $derived(
  editor.background.preset === "custom" ? editor.background.hex : "#000000",
);

const running = $derived(editor.cutoutStatus === "running");
const noCropper = $derived(!editor.cropper);
const sheetDisabled = $derived(noCropper || !isSheetEligible(editor.spec));

function pickPreset(p: BackgroundPreset) {
  editor.setBackground(BACKGROUNDS[p]);
}

function pickCustom(e: Event) {
  const hex = (e.currentTarget as HTMLInputElement).value;
  editor.setBackground({ preset: "custom", hex });
}

async function runCutout() {
  if (!editor.sourceUrl) return;
  editor.error = null;
  editor.cutoutStatus = "running";
  editor.cutoutProgress = 0;
  try {
    const blob = await (await fetch(editor.sourceUrl)).blob();
    const result = await removeBackground(blob, (r) => {
      editor.cutoutProgress = r;
    });
    editor.applyCutout(URL.createObjectURL(result));
  } catch (err) {
    editor.error = err instanceof Error ? err.message : "AI 抠图失败";
    editor.cutoutStatus = "error";
  }
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
    <label
      class="custom"
      class:sel={editor.background.preset === "custom"}
      class:picked={editor.background.preset === "custom"}
      title="自定义背景色"
      style:--picked={customHex}
    >
      <span class="custom-chip" aria-hidden="true">
        <IconPen />
      </span>
      <span class="custom-label">自定义</span>
      <input type="color" value={customHex} oninput={pickCustom} aria-label="自定义背景色" />
    </label>
  </div>

  <div class="cut">
    <Button onclick={runCutout} disabled={!editor.sourceUrl || running}>
      {running ? "抠图中…" : "AI 抠图换底"}
    </Button>
    <p class="hint">模型本地自托管，完全离线运行；首次加载稍慢。</p>
    {#if running}
      <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(editor.cutoutProgress * 100)}>
        <span style:width={`${Math.round(editor.cutoutProgress * 100)}%`}></span>
      </div>
      <p class="hint">处理进度 {Math.round(editor.cutoutProgress * 100)}%</p>
    {/if}
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
  /* Custom color = a clear labelled pill, not a bare native dot. The chip
     shows a rainbow (universal "pick any color"); once a custom color is
     chosen it shows that color. The native picker sits invisibly on top. */
  .custom {
    position: relative;
    height: 32px;
    display: flex;
    align-items: center;
    gap: var(--sp-xxs);
    padding: 0 10px 0 4px;
    border-radius: var(--r-full);
    border: 1px solid var(--c-hairline);
    background: var(--c-surface-1);
    color: var(--c-ink);
    cursor: pointer;
    font-size: var(--t-caption-size);
  }
  .custom.sel {
    box-shadow: 0 0 0 2px var(--c-accent);
  }
  .custom-chip {
    width: 22px;
    height: 22px;
    border-radius: var(--r-full);
    display: grid;
    place-items: center;
    color: #fff;
    border: 1px solid var(--c-hairline);
    background: conic-gradient(
      red,
      yellow,
      lime,
      aqua,
      blue,
      magenta,
      red
    );
  }
  .custom.picked .custom-chip {
    background: var(--picked);
  }
  .custom-chip :global(svg) {
    width: 12px;
    height: 12px;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));
  }
  .custom-label {
    white-space: nowrap;
  }
  .custom input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
  }
  .cut {
    margin-bottom: var(--sp-md);
    display: grid;
    gap: var(--sp-xs);
  }
  .hint {
    margin: 0;
    font-size: var(--t-body-sm-size);
    color: var(--c-soft);
  }
  .bar {
    height: 6px;
    border-radius: var(--r-full);
    background: var(--c-surface-1);
    border: 1px solid var(--c-hairline);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--c-accent);
    transition: width 0.2s ease;
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
