<script lang="ts">
import { ACCEPT_ATTR, ACCEPTED_LABEL, MAX_MB, validateImageFile } from "../../domain/formats";
import Panel from "./Panel.svelte";

// Single source of truth for the image-source area, shared by the 证件照
// and 图片工具 pages. Behaviour identical; callers bind their own store
// via the `onaccept` / `onclear` callbacks and `loaded`/`fileName`/`meta`.
interface Props {
  label: string;
  loaded: boolean;
  fileName: string | null;
  /** Optional extra line under the filename (e.g. original size). */
  meta?: string;
  onaccept: (file: File) => void;
  onclear: () => void;
}

let { label, loaded, fileName, meta, onaccept, onclear }: Props = $props();

let dragOver = $state(false);
let localError = $state<string | null>(null);
let input: HTMLInputElement;

function accept(file: File | undefined | null) {
  if (!file) return;
  const err = validateImageFile(file);
  if (err) {
    localError = err;
    return;
  }
  localError = null;
  onaccept(file);
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
function reselect() {
  input.click();
}
function clear() {
  onclear();
  localError = null;
  if (input) input.value = "";
}
</script>

<Panel {label}>
  {#if loaded}
    <div class="loaded">
      <div class="meta">
        <span class="badge">已加载</span>
        <span class="name" title={fileName ?? ""}>{fileName ?? "已选择图片"}</span>
      </div>
      {#if meta}<p class="size">{meta}</p>{/if}
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
      ondragleave={() => (dragOver = false)}
    >
      拖拽 / 点击上传图片
      <span class="hint">支持 {ACCEPTED_LABEL} · ≤ {MAX_MB} MB</span>
    </button>
  {/if}

  <input bind:this={input} type="file" accept={ACCEPT_ATTR} onchange={onPick} hidden />

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
    font-family: inherit;
    font-size: var(--t-body-sm-size);
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .drop:hover,
  .drop.over {
    border-color: var(--c-border-strong);
    background: var(--c-surface-2);
  }
  .drop.over {
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
  .actions {
    display: flex;
    gap: var(--sp-sm);
  }
  .act {
    flex: 1;
    background: transparent;
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: var(--sp-sm) var(--sp-md);
    color: var(--c-body);
    cursor: pointer;
    font-family: inherit;
    font-size: var(--t-body-sm-size);
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .act:hover {
    border-color: var(--c-border-strong);
    background: var(--c-surface-3);
    color: var(--c-ink);
  }
  .act.danger {
    color: var(--c-danger);
  }
  .act.danger:hover {
    border-color: var(--c-danger);
  }
  .error {
    margin: var(--sp-sm) 0 0;
    color: var(--c-danger);
    font-size: var(--t-body-sm-size);
  }
</style>
