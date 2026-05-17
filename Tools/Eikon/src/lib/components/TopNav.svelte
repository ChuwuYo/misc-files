<script lang="ts">
import { route, type RouteId } from "../state/route.svelte";
import ThemeToggle from "./ui/ThemeToggle.svelte";

const tabs: { id: RouteId; label: string }[] = [
  { id: "maker", label: "证件照" },
  { id: "tools", label: "图片工具" },
];
</script>

<header class="top">
  <span class="brand-mark" aria-hidden="true">
    <svg viewBox="0 0 200 200">
      <defs>
        <mask id="nav-carve-base">
          <rect width="200" height="200" fill="white" />
          <circle cx="180" cy="180" r="120" fill="black" />
          <circle cx="20" cy="80" r="40" fill="black" />
        </mask>
        <mask id="nav-carve-global">
          <rect width="200" height="200" fill="white" />
          <line x1="20" y1="180" x2="180" y2="20" stroke="black" stroke-width="2.5" />
        </mask>
      </defs>
      <g mask="url(#nav-carve-global)" fill="currentColor">
        <rect x="25" y="25" width="150" height="150" rx="35" mask="url(#nav-carve-base)" />
        <circle cx="132" cy="132" r="15" />
        <circle cx="132" cy="132" r="30" fill="none" stroke="currentColor" stroke-width="1.5" />
      </g>
    </svg>
  </span>
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
  /* Brand mark — currentColor follows the in-app theme token (light:
     Solarized blue, dark: white), switching with the theme toggle. */
  .brand-mark {
    display: inline-flex;
    width: 24px;
    height: 24px;
    color: var(--c-accent);
  }
  .brand-mark svg {
    width: 100%;
    height: 100%;
    display: block;
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
