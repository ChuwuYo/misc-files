<script lang="ts">
import Panel from "../ui/Panel.svelte";
import { tools } from "../../state/tools.svelte";
import { ACCEPT_ATTR, ACCEPTED_LABEL, MAX_MB, validateImageFile } from "../../domain/formats";

let dragOver = $state(false);
let localError = $state<string | null>(null);
let fileName = $state<string | null>(null);
let input: HTMLInputElement;

const loaded = $derived(tools.sourceUrl !== null);

function accept(file: File | undefined | null) {
  if (!file) return;
  const err = validateImageFile(file, "tools");
  if (err) {
    localError = err;
    return;
  }
  localError = null;
  fileName = file.name;
  tools.setSource(URL.createObjectURL(file), file.size);
}

function onPick(e: Event) {
  accept((e.target as HTMLInputElement).files?.[0]);
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dragOver = false;
  accept(e.dataTransfer?.files?.[0]);
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  dragOver = true;
}

function onDragLeave() {
  dragOver = false;
}

function reselect() {
  input.click();
}

function clear() {
  tools.reset();
  fileName = null;
  localError = null;
  if (input) input.value = "";
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
</script>

<Panel label="① 图片来源">
  {#if loaded}
    <div class="loaded">
      <div class="meta">
        <span class="badge">已加载</span>
        <span class="name" title={fileName ?? ""}>{fileName ?? "已选择图片"}</span>
      </div>
      <p class="size">原始大小 · {fmtBytes(tools.sourceBytes)}</p>
      <div class="actions">
        <button type="button" class="act" onclick={reselect}>重新选择</button>
        <button type="button" class="act danger" onclick={clear}>清除</button>
      </div>
    </div>
  {:else}
    <button
      type="button"
      class="drop"
      class:over={dragOver}
      onclick={reselect}
      ondrop={onDrop}
      ondragover={onDragOver}
      ondragleave={onDragLeave}
    >
      拖拽 / 点击上传图片
      <span class="hint">支持 {ACCEPTED_LABEL} · ≤ {MAX_MB.tools} MB</span>
    </button>
  {/if}

  <input
    bind:this={input}
    type="file"
    accept={ACCEPT_ATTR}
    onchange={onPick}
    hidden
  />

  {#if localError}
    <p class="error">{localError}</p>
  {/if}
</Panel>

<style>
  .drop {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    width: 100%;
    background: var(--c-surface-1);
    border: 1px dashed var(--c-hairline);
    border-radius: var(--r-md);
    padding: var(--sp-lg);
    text-align: center;
    color: var(--c-body);
    cursor: pointer;
    font: inherit;
    font-size: var(--t-body-sm-size);
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .drop:hover { border-color: var(--c-soft); }
  .drop.over {
    border-color: var(--c-soft);
    border-style: solid;
  }
  .hint {
    color: var(--c-soft);
    font-size: var(--t-body-sm-size);
  }

  .loaded {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
    background: var(--c-surface-1);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: var(--sp-lg);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    min-width: 0;
  }
  .badge {
    flex: none;
    color: var(--c-soft);
    font: var(--t-eyebrow-weight) var(--t-eyebrow-size) var(--font-mono);
    letter-spacing: var(--t-eyebrow-ls);
    text-transform: uppercase;
  }
  .name {
    color: var(--c-ink);
    font-size: var(--t-body-sm-size);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .size {
    margin: 0;
    color: var(--c-soft);
    font-size: var(--t-caption-size);
    letter-spacing: var(--t-caption-ls);
  }
  .actions { display: flex; gap: var(--sp-sm); }
  .act {
    flex: 1;
    background: transparent;
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: var(--sp-sm) var(--sp-md);
    color: var(--c-body);
    cursor: pointer;
    font: inherit;
    font-size: var(--t-body-sm-size);
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .act:hover { border-color: var(--c-soft); color: var(--c-ink); }
  .act.danger { color: var(--c-danger); }
  .act.danger:hover { border-color: var(--c-danger); }

  .error {
    margin: var(--sp-sm) 0 0;
    color: var(--c-danger);
    font-size: var(--t-body-sm-size);
  }
</style>
