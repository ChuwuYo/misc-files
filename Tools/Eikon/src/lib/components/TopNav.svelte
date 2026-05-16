<script lang="ts">
import { route, type RouteId } from "../state/route.svelte";
import ThemeToggle from "./ui/ThemeToggle.svelte";

const tabs: { id: RouteId; label: string }[] = [
  { id: "maker", label: "证件照" },
  { id: "tools", label: "图片工具" },
];
</script>

<header class="top">
  <span class="dot"></span>
  <h1>方寸 <span class="en">Eikon</span></h1>
  <nav class="tabs">
    {#each tabs as t (t.id)}
      <button
        class="tab"
        class:on={route.current === t.id}
        onclick={() => route.go(t.id)}
      >{t.label}</button>
    {/each}
  </nav>
  <ThemeToggle />
</header>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: var(--sp-md);
    height: 56px;
    padding: 0 var(--sp-lg);
    border-bottom: 1px solid var(--c-hairline);
    background: var(--c-canvas);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--r-full);
    background: var(--c-accent);
  }
  h1 {
    font: var(--t-card-title-weight) var(--t-card-title-size) var(--font-sans);
    color: var(--c-ink);
    margin: 0;
    letter-spacing: 0.5px;
  }
  h1 .en {
    font-family: var(--font-mono);
    font-weight: 460;
    color: var(--c-soft);
    letter-spacing: 1px;
  }
  .tabs {
    display: flex;
    gap: var(--sp-xs);
    margin-left: var(--sp-lg);
  }
  .tab {
    font: var(--t-button-weight) var(--t-body-sm-size) var(--font-sans);
    color: var(--c-soft);
    background: transparent;
    border: none;
    border-radius: var(--r-pill);
    padding: 6px 16px;
    cursor: pointer;
  }
  .tab.on {
    color: var(--c-on-accent);
    background: var(--c-accent);
  }
  :global(.top .toggle) {
    margin-left: auto;
  }
</style>
