<script lang="ts">
import Konva from "konva";
import { applyColor, renderAdjusted, sharpenInPlace } from "../../core/adjust";
import { createProxy, type Proxy } from "../../core/proxy";
import { tools } from "../../state/tools.svelte";
import { preview } from "./preview.svelte";

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const SHARPEN_DEBOUNCE = 120;

let stageEl: HTMLDivElement | undefined = $state();
let loading = $state(false);
let loadError = $state(false);

// Full-resolution source + downscaled proxy (kept in sync with sourceUrl).
let img: HTMLImageElement | null = null;
let proxy: Proxy | null = null;

// Konva objects.
let stage: Konva.Stage | null = null;
let layer: Konva.Layer | null = null;
let node: Konva.Image | null = null;

let resizeObs: ResizeObserver | null = null;
let sharpenTimer: ReturnType<typeof setTimeout> | undefined;
// Guards stale async sharpen runs from clobbering newer state.
let renderGen = 0;

function destroyStage() {
  if (sharpenTimer) clearTimeout(sharpenTimer);
  sharpenTimer = undefined;
  stage?.destroy();
  stage = null;
  layer = null;
  node = null;
}

function ensureStage() {
  if (stage || !stageEl) return;
  stage = new Konva.Stage({
    container: stageEl,
    width: stageEl.clientWidth || 1,
    height: stageEl.clientHeight || 1,
  });
  layer = new Konva.Layer();
  stage.add(layer);
  node = new Konva.Image({ image: undefined, draggable: true });
  layer.add(node);
  stage.on("wheel", onWheel);
}

function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
  if (!stage || !node) return;
  e.evt.preventDefault();
  const oldScale = node.scaleX();
  const pointer = stage.getPointerPosition();
  if (!pointer) return;
  const mousePoint = {
    x: (pointer.x - node.x()) / oldScale,
    y: (pointer.y - node.y()) / oldScale,
  };
  const dir = e.evt.deltaY > 0 ? -1 : 1;
  let newScale = dir > 0 ? oldScale * 1.1 : oldScale / 1.1;
  newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
  node.scale({ x: newScale, y: newScale });
  node.position({
    x: pointer.x - mousePoint.x * newScale,
    y: pointer.y - mousePoint.y * newScale,
  });
  layer?.batchDraw();
}

function fitToStage() {
  if (!stage || !node || !proxy) return;
  const pad = 24;
  const sw = stage.width();
  const sh = stage.height();
  const fit = Math.min((sw - pad * 2) / proxy.width, (sh - pad * 2) / proxy.height);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, fit));
  node.scale({ x: scale, y: scale });
  node.position({
    x: (sw - proxy.width * scale) / 2,
    y: (sh - proxy.height * scale) / 2,
  });
  layer?.batchDraw();
}

function actualSize() {
  if (!stage || !node || !proxy) return;
  node.scale({ x: 1, y: 1 });
  node.position({
    x: (stage.width() - proxy.width) / 2,
    y: (stage.height() - proxy.height) / 2,
  });
  layer?.batchDraw();
}

function resizeStage() {
  if (!stage || !stageEl) return;
  stage.width(stageEl.clientWidth || 1);
  stage.height(stageEl.clientHeight || 1);
  layer?.batchDraw();
}

// Apply current color adjustments to the proxy and show it instantly,
// then debounce the (async, WASM) sharpen pass.
function applyAdjustments() {
  if (!proxy || !node || !layer) return;
  const adj = { ...tools.adj };
  const color = applyColor(proxy.canvas, proxy.width, proxy.height, adj);
  node.image(color);
  layer.batchDraw();

  const gen = ++renderGen;
  if (sharpenTimer) clearTimeout(sharpenTimer);
  if (adj.sharpen <= 0) return;
  sharpenTimer = setTimeout(async () => {
    const sharp = document.createElement("canvas");
    sharp.width = color.width;
    sharp.height = color.height;
    sharp.getContext("2d")?.drawImage(color, 0, 0);
    await sharpenInPlace(sharp, adj.sharpen);
    if (gen !== renderGen || !node || !layer) return;
    node.image(sharp);
    layer.batchDraw();
  }, SHARPEN_DEBOUNCE);
}

// Load / reload the source image whenever the URL changes.
$effect(() => {
  const url = tools.sourceUrl;
  loadError = false;
  destroyStage();
  img = null;
  proxy = null;
  preview.registerFullRenderer(null);

  if (!url) {
    loading = false;
    return;
  }

  loading = true;
  const el = new Image();
  el.onload = () => {
    img = el;
    proxy = createProxy(el);
    loading = false;
    ensureStage();
    applyAdjustments();
    fitToStage();
    preview.registerFullRenderer(async () => {
      if (!img) return null;
      const c = await renderAdjusted(img, img.naturalWidth, img.naturalHeight, { ...tools.adj });
      return await new Promise<Blob | null>((r) => c.toBlob((b) => r(b), "image/png"));
    });
  };
  el.onerror = () => {
    loading = false;
    loadError = true;
  };
  el.src = url;

  return () => {
    el.onload = null;
    el.onerror = null;
  };
});

// Live update on adjustment changes.
$effect(() => {
  const a = tools.adj;
  void a.brightness;
  void a.contrast;
  void a.saturation;
  void a.sharpen;
  if (proxy && node) applyAdjustments();
});

$effect(() => {
  if (!stageEl) return;
  resizeObs = new ResizeObserver(() => resizeStage());
  resizeObs.observe(stageEl);
  return () => {
    resizeObs?.disconnect();
    resizeObs = null;
  };
});

$effect(() => {
  return () => {
    destroyStage();
    preview.registerFullRenderer(null);
  };
});
</script>

<div class="stage-wrap">
  {#if tools.sourceUrl}
    <div class="stage" bind:this={stageEl}></div>
    {#if loading}
      <p class="hint floating">正在加载图片…</p>
    {:else if loadError}
      <p class="hint floating">图片加载失败</p>
    {:else}
      <div class="controls">
        <button type="button" onclick={actualSize}>1:1</button>
        <button type="button" onclick={fitToStage}>适应</button>
        <button type="button" onclick={fitToStage}>重置</button>
      </div>
    {/if}
  {:else}
    <div class="empty">
      <p class="title">实时预览</p>
      <p class="hint">从左侧加载图片后，调整效果会实时显示在这里</p>
    </div>
  {/if}
</div>

<style>
  .stage-wrap {
    position: relative;
    height: 100%;
    display: grid;
    place-items: center;
    background: var(--c-canvas);
    overflow: hidden;
  }
  .stage {
    position: absolute;
    inset: 0;
    cursor: grab;
  }
  .stage:active {
    cursor: grabbing;
  }
  .controls {
    position: absolute;
    bottom: var(--sp-md);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: var(--sp-xs);
    padding: var(--sp-xs);
    background: var(--c-surface-1);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    box-shadow: var(--elev-2);
  }
  .controls button {
    border: 1px solid var(--c-hairline);
    background: var(--c-canvas);
    color: var(--c-ink);
    padding: var(--sp-xs) var(--sp-sm);
    border-radius: var(--r-sm);
    font-size: var(--t-body-sm-size);
    cursor: pointer;
  }
  .controls button:hover {
    border-color: var(--c-accent);
    color: var(--c-accent);
  }
  .empty {
    text-align: center;
  }
  .title {
    margin: 0 0 var(--sp-xs);
    color: var(--c-ink);
    font: var(--t-headline-weight) var(--t-headline-size) var(--font-sans);
  }
  .hint {
    margin: 0;
    color: var(--c-soft);
    font-size: var(--t-body-sm-size);
  }
  .hint.floating {
    position: absolute;
  }
</style>
