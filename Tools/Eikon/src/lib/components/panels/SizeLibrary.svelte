<script lang="ts">
import IconChevron from "~icons/iconamoon/arrow-right-2";
import Panel from "../ui/Panel.svelte";
import { PHOTO_SPECS, customSpec } from "../../domain/sizes";
import { editor } from "../../state/editor.svelte";
import type { PhotoSpec } from "../../domain/types";

let query = $state("");

const GROUPS: { key: PhotoSpec["category"]; label: string }[] = [
  { key: "common", label: "常用" },
  { key: "id", label: "证件" },
  { key: "passport-visa", label: "护照签证" },
  { key: "certificate", label: "证书考试" },
  { key: "photo-paper", label: "相纸" },
];

const filtered = $derived(PHOTO_SPECS.filter((s) => s.name.includes(query)));

const groups = $derived(
  GROUPS.map((g) => ({
    ...g,
    items: filtered.filter((s) => s.category === g.key),
  })).filter((g) => g.items.length > 0),
);

// Accordion state. Reactive ($state); seeded once so the group holding the
// current selection starts open and the rest are collapsed.
let openMap = $state<Record<string, boolean>>({});
let seeded = $state(false);

$effect(() => {
  if (!seeded) {
    openMap = { [editor.spec.category]: true };
    seeded = true;
  }
});

const searching = $derived(query.trim().length > 0);

// While searching, force every matching group open so results are visible;
// otherwise follow the user-controlled map.
function isOpen(key: string): boolean {
  return searching || openMap[key] === true;
}

function toggle(key: string) {
  openMap = { ...openMap, [key]: !(openMap[key] === true) };
}

let showCustom = $state(false);
let cw = $state(25);
let ch = $state(35);
let cdpi = $state(300);

const customError = $derived.by(() => {
  if (!(cw > 0 && ch > 0 && cdpi > 0)) return "数值需大于 0";
  if (cw > 600 || ch > 600) return "毫米数不得超过 600";
  if (cdpi < 72 || cdpi > 1200) return "DPI 需在 72–1200 之间";
  return null;
});

function submitCustom() {
  if (customError) return;
  editor.setSpec(customSpec(cw, ch, cdpi));
}
</script>

<Panel label="② 尺寸库">
  <input class="search" placeholder="搜索尺寸…" bind:value={query} />

  {#each groups as g (g.key)}
    {@const open = isOpen(g.key)}
    <div class="group">
      <button
        type="button"
        class="group-head"
        onclick={() => toggle(g.key)}
        aria-expanded={open}
      >
        <span class="chev" class:open><IconChevron /></span>
        <span class="group-label">{g.label}</span>
        <span class="count">{g.items.length}</span>
      </button>
      {#if open}
        <ul class="list">
          {#each g.items as s (s.id)}
            <li>
              <button
                class="row"
                class:sel={editor.spec.id === s.id}
                onclick={() => editor.setSpec(s)}
              >
                <span class="name">{s.name}</span>
                <em>{s.widthMm}×{s.heightMm}mm · {s.widthPx}×{s.heightPx}</em>
                {#if s.note}<small>{s.note}</small>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/each}

  <div class="custom">
    <button
      class="toggle"
      onclick={() => (showCustom = !showCustom)}
      aria-expanded={showCustom}
    >
      ＋ 自定义尺寸
    </button>

    {#if showCustom}
      <div class="form">
        <label>
          <span>宽 (mm)</span>
          <input type="number" min="1" step="any" bind:value={cw} />
        </label>
        <label>
          <span>高 (mm)</span>
          <input type="number" min="1" step="any" bind:value={ch} />
        </label>
        <label>
          <span>DPI</span>
          <input type="number" min="72" max="1200" step="1" bind:value={cdpi} />
        </label>

        {#if customError}
          <p class="hint">{customError}</p>
        {/if}

        <button class="apply" disabled={!!customError} onclick={submitCustom}>
          应用自定义尺寸
        </button>
      </div>
    {/if}
  </div>
</Panel>

<style>
  .search {
    width: 100%;
    background: var(--c-surface-1);
    color: var(--c-ink);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: 8px 10px;
    margin-bottom: var(--sp-sm);
  }
  .group {
    margin-bottom: 6px;
  }
  .group-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sp-xs);
    background: var(--c-surface-1);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: 7px 10px;
    cursor: pointer;
    color: var(--c-ink);
    font: var(--t-eyebrow-weight) var(--t-eyebrow-size) var(--font-mono);
    letter-spacing: var(--t-eyebrow-ls);
    text-transform: uppercase;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .group-head:hover {
    border-color: var(--c-border-strong);
    background: var(--c-surface-2);
  }
  .group-head[aria-expanded="true"] {
    border-color: var(--c-accent);
    color: var(--c-accent);
  }
  .chev {
    display: grid;
    place-items: center;
    color: var(--c-soft);
    font-size: 13px;
    transition: transform 0.15s ease;
  }
  .chev :global(svg) {
    width: 1em;
    height: 1em;
    display: block;
  }
  .chev.open {
    transform: rotate(90deg);
    color: var(--c-accent);
  }
  .group-label {
    flex: 1;
    text-align: left;
  }
  .count {
    color: var(--c-soft);
    background: var(--c-canvas);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-full);
    padding: 1px 7px;
    font-size: var(--t-caption-size);
  }
  .list {
    list-style: none;
    /* Gap below the parent header so the first option isn't glued to it. */
    margin: var(--sp-sm) 0 var(--sp-md);
    /* Indent options by one chevron-column (icon 13px + gap 8px + head
       padding 10px ≈ 22px) so they read as children of the header, plus a
       hairline rail that visually connects them to their group. */
    padding: 0 0 0 var(--sp-sm);
    margin-left: 22px;
    border-left: 2px solid var(--c-hairline);
    display: grid;
    gap: 6px;
  }
  .row {
    width: 100%;
    text-align: left;
    /* Lighter than the filled header so the header reads as the parent. */
    background: transparent;
    color: var(--c-ink);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: 8px 10px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .row:hover {
    background: var(--c-surface-3);
    border-color: var(--c-border-strong);
  }
  .row.sel {
    box-shadow: 0 0 0 2px var(--c-accent) inset;
  }
  .row .name {
    color: var(--c-ink);
  }
  .row em {
    color: var(--c-soft);
    font-size: var(--t-caption-size);
    font-style: normal;
  }
  .row small {
    color: var(--c-soft);
    font-size: var(--t-caption-size);
  }
  .custom {
    margin-top: var(--sp-md);
  }
  .toggle {
    width: 100%;
    text-align: left;
    background: var(--c-surface-1);
    color: var(--c-ink);
    border: 1px dashed var(--c-hairline);
    border-radius: var(--r-md);
    padding: 8px 10px;
    cursor: pointer;
  }
  .form {
    display: grid;
    gap: var(--sp-sm);
    margin-top: var(--sp-sm);
  }
  .form label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-sm);
    color: var(--c-soft);
    font-size: var(--t-caption-size);
  }
  .form input {
    width: 50%;
    background: var(--c-surface-1);
    color: var(--c-ink);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-md);
    padding: 8px 10px;
  }
  .hint {
    margin: 0;
    color: var(--c-accent);
    font-size: var(--t-caption-size);
  }
  .apply {
    background: var(--c-accent);
    color: var(--c-surface-1);
    border: 1px solid var(--c-accent);
    border-radius: var(--r-md);
    padding: 8px 10px;
    cursor: pointer;
  }
  .apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
