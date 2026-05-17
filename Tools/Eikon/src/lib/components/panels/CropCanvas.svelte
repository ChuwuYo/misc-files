<script lang="ts">
import { onDestroy } from "svelte";
import Panel from "../ui/Panel.svelte";
import { editor } from "../../state/editor.svelte";
import { createCropper, type CropperHandle } from "../../core/cropper";
import "cropperjs";

let containerEl: HTMLDivElement;
let handle = $state<CropperHandle | null>(null);
let mountedUrl: string | null = null;
let loadToken = 0;

function teardown(): void {
  loadToken++;
  handle?.destroy();
  handle = null;
  mountedUrl = null;
  editor.registerCropper(null);
}

function mountFor(url: string): void {
  if (!containerEl) return;
  const token = ++loadToken;
  const img = new Image();
  img.onload = () => {
    // Bail if a newer load started, the source changed, or torn down.
    if (token !== loadToken || editor.sourceUrl !== url || !containerEl) return;
    handle?.destroy();
    handle = createCropper(containerEl);
    handle.mount(img);
    handle.setAspectRatio(editor.aspectRatio);
    editor.registerCropper(handle);
    mountedUrl = url;
  };
  img.onerror = () => {
    // Ignore stale failures from a superseded load.
    if (token !== loadToken) return;
    editor.error = "图片加载失败";
  };
  img.src = url;
}

// React to source changes (initial upload, AI cutout swap) → (re)mount.
$effect(() => {
  const url = editor.sourceUrl;
  if (!url) {
    if (mountedUrl !== null) teardown();
    return;
  }
  if (url !== mountedUrl) mountFor(url);
});

// React to aspect-ratio changes → re-lock the crop box.
$effect(() => {
  const ratio = editor.aspectRatio;
  if (handle) handle.setAspectRatio(ratio);
});

onDestroy(teardown);
</script>

<Panel label="③ 裁剪">
  <div class="toolbar" role="toolbar" aria-label="裁剪工具">
    <button type="button" disabled={!handle} onclick={() => handle?.rotate(-90)}>旋转-90°</button>
    <button type="button" disabled={!handle} onclick={() => handle?.rotate(90)}>旋转+90°</button>
    <button type="button" disabled={!handle} onclick={() => handle?.zoom(0.1)}>放大</button>
    <button type="button" disabled={!handle} onclick={() => handle?.zoom(-0.1)}>缩小</button>
    <button type="button" disabled={!handle} onclick={() => handle?.recenter()}>居中</button>
    <button type="button" disabled={!handle} onclick={() => handle?.reset()}>重置</button>
  </div>

  <div class="canvas" class:empty={!editor.sourceUrl}>
    <div class="stage" bind:this={containerEl}></div>
    {#if !editor.sourceUrl}
      <p class="hint">上传照片后在此裁剪</p>
    {/if}
  </div>
</Panel>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
    margin: 0 0 var(--sp-sm);
  }
  .toolbar button {
    appearance: none;
    border: 1px solid var(--c-hairline);
    background: var(--c-surface-1);
    color: var(--c-ink);
    border-radius: var(--r-md);
    padding: var(--sp-xs) var(--sp-sm);
    font: inherit;
    font-size: var(--t-body-sm-size);
    cursor: pointer;
  }
  .toolbar button:hover:not(:disabled) {
    border-color: var(--c-border-strong);
    background: var(--c-surface-3);
    color: var(--c-ink);
  }
  .toolbar button:disabled {
    color: var(--c-soft);
    cursor: not-allowed;
  }

  .canvas {
    position: relative;
    background: var(--c-surface-1);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    /* Definite height so the cropper-canvas fills it instead of collapsing
       to the image's intrinsic size and leaving a large empty block. */
    height: clamp(360px, calc(100vh - 220px), 1000px);
    overflow: hidden;
  }
  .canvas.empty {
    display: grid;
    place-items: center;
  }
  .stage {
    width: 100%;
    height: 100%;
  }
  .stage :global(cropper-canvas) {
    width: 100%;
    height: 100%;
  }
  .hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: var(--c-soft);
    font-size: var(--t-body-sm-size);
    margin: 0;
  }
</style>
