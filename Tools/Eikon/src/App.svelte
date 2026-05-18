<script lang="ts">
import { onMount } from "svelte";
import { theme } from "./lib/state/theme.svelte";
import { route } from "./lib/state/route.svelte";
import TopNav from "./lib/components/TopNav.svelte";

// Route-level code splitting: each page (and its heavy libs — Cropper.js
// for maker, Konva/pica for tools) ships only when that route is opened.
const loaders = {
  maker: () => import("./lib/pages/MakerPage.svelte"),
  tools: () => import("./lib/pages/ToolsPage.svelte"),
};

// Memoize per route so {#await} doesn't get a fresh Promise every render.
const cache: Partial<Record<keyof typeof loaders, ReturnType<typeof loaders.maker>>> = {};
function page(r: keyof typeof loaders) {
  return (cache[r] ??= loaders[r]());
}

const ROUTE_TITLE: Record<string, string> = {
  maker: "证件照",
  tools: "图片工具",
};

onMount(() => {
  theme.init();
  route.init();
});

// Web tab title reflects the active top-nav sub-page.
$effect(() => {
  document.title = `${ROUTE_TITLE[route.current] ?? ""} · 方寸 Eikon`;
});

// Log chunk-load failures so production issues are diagnosable; returns
// "" so it can be used inline in the {:catch} markup.
function logPageError(err: unknown): string {
  console.error("page chunk load failed", err);
  return "";
}
</script>

<TopNav />

{#await page(route.current) then mod}
  {@const Page = mod.default}
  <Page />
{:catch err}
  <p class="load-err" role="alert">{logPageError(err)}页面加载失败，请刷新重试</p>
{/await}

<style>
  .load-err {
    padding: var(--sp-xl);
    text-align: center;
    color: var(--c-danger);
  }
</style>
