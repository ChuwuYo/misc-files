<script lang="ts">
import { onMount } from "svelte";
import { theme } from "./lib/state/theme.svelte";
import { route } from "./lib/state/route.svelte";
import TopNav from "./lib/components/TopNav.svelte";

// Route-level code splitting: each page (and its heavy libs — Cropper.js
// for maker, Konva/Photon for tools) ships only when that route is opened.
const pages = {
  maker: () => import("./lib/pages/MakerPage.svelte"),
  tools: () => import("./lib/pages/ToolsPage.svelte"),
};

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
</script>

<TopNav />

{#await pages[route.current]() then mod}
  {@const Page = mod.default}
  <Page />
{:catch}
  <p class="load-err" role="alert">页面加载失败，请刷新重试</p>
{/await}

<style>
  .load-err {
    padding: var(--sp-xl);
    text-align: center;
    color: var(--c-danger);
  }
</style>
