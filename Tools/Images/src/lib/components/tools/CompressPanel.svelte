<script lang="ts">
import Panel from "../ui/Panel.svelte";
import Button from "../ui/Button.svelte";
import { tools } from "../../state/tools.svelte";
import { compressImage } from "../../core/compress";
import { preview } from "./preview.svelte";

let format = $state<"png" | "jpeg">("png");
let jpegQuality = $state(90);

const disabled = $derived(!preview.ready || tools.busy || tools.sourceUrl === null);

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const savedPct = $derived.by(() => {
  const c = tools.compressed;
  if (!c || c.originalBytes === 0) return 0;
  return Math.round((1 - c.compressedBytes / c.originalBytes) * 100);
});

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function run() {
  tools.error = null;
  tools.busy = true;
  try {
    const adjusted = await preview.renderFull();
    if (!adjusted) {
      tools.error = preview.ready ? "预览未就绪" : "请先加载图片";
      return;
    }
    const result = await compressImage(adjusted, format, {
      jpegQuality: format === "jpeg" ? jpegQuality : undefined,
    });
    tools.compressed = result;
    download(result.blob, `image-tool.${format === "png" ? "png" : "jpg"}`);
  } catch (err) {
    tools.error = err instanceof Error ? err.message : String(err);
  } finally {
    tools.busy = false;
  }
}
</script>

<Panel label="③ 压缩与下载">
  <div class="body" class:dim={tools.sourceUrl === null}>
    <div class="formats">
      <button
        type="button"
        class="fmt"
        class:on={format === "png"}
        disabled={tools.busy}
        onclick={() => (format = "png")}
      >
        PNG
        <span class="sub">无损 · oxipng</span>
      </button>
      <button
        type="button"
        class="fmt"
        class:on={format === "jpeg"}
        disabled={tools.busy}
        onclick={() => (format = "jpeg")}
      >
        JPEG
        <span class="sub">高质量 · mozjpeg</span>
      </button>
    </div>

    {#if format === "jpeg"}
      <div class="quality">
        <div class="head">
          <label for="jpeg-q">质量</label>
          <span class="val">{jpegQuality}</span>
        </div>
        <input
          id="jpeg-q"
          type="range"
          min="70"
          max="100"
          step="1"
          disabled={tools.busy}
          bind:value={jpegQuality}
        />
      </div>
    {/if}

    <Button onclick={run} {disabled}>
      {tools.busy ? "压缩中…" : "压缩并下载"}
    </Button>

    {#if tools.compressed}
      <div class="readout">
        <div class="line">
          <span>压缩前</span><span class="num">{fmtBytes(tools.compressed.originalBytes)}</span>
        </div>
        <div class="line">
          <span>压缩后</span><span class="num">{fmtBytes(tools.compressed.compressedBytes)}</span>
        </div>
        <div class="line saved">
          <span>已节省</span><span class="num">{savedPct}%</span>
        </div>
      </div>
    {/if}

    {#if tools.error}
      <p class="error">{tools.error}</p>
    {/if}
  </div>
</Panel>

<style>
  .body { display: flex; flex-direction: column; gap: var(--sp-md); }
  /* No source yet: the action button is disabled and a hint shows, but the
     format controls stay fully legible (they're still interactive). */
  .body.dim { opacity: 1; }

  .formats { display: flex; gap: var(--sp-sm); }
  .fmt {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
    background: var(--c-surface-1);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: var(--sp-sm) var(--sp-md);
    color: var(--c-ink);
    cursor: pointer;
    font: inherit;
    font-size: var(--t-body-sm-size);
    text-align: left;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .fmt:not(:disabled):hover { border-color: var(--c-accent); }
  .fmt.on {
    border-color: var(--c-accent);
    box-shadow: 0 0 0 1px var(--c-accent) inset;
    color: var(--c-ink);
  }
  .fmt:disabled { cursor: not-allowed; opacity: 0.5; }
  .sub {
    color: var(--c-body);
    font-size: var(--t-caption-size);
    letter-spacing: var(--t-caption-ls);
  }

  .quality { display: flex; flex-direction: column; gap: var(--sp-xs); }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  label { color: var(--c-ink); font-size: var(--t-body-sm-size); }
  .val {
    color: var(--c-soft);
    font: var(--t-caption-weight) var(--t-caption-size) var(--font-mono);
    letter-spacing: var(--t-caption-ls);
  }
  input[type="range"] {
    width: 100%;
    accent-color: var(--c-accent);
    cursor: pointer;
  }
  input[type="range"]:disabled { cursor: not-allowed; }

  .readout {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    background: var(--c-surface-1);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: var(--sp-md);
  }
  .line {
    display: flex;
    justify-content: space-between;
    color: var(--c-body);
    font-size: var(--t-body-sm-size);
  }
  .num { font-family: var(--font-mono); color: var(--c-ink); }
  .line.saved .num { color: var(--c-success); }

  .error {
    margin: 0;
    color: var(--c-danger);
    font-size: var(--t-body-sm-size);
  }
</style>
