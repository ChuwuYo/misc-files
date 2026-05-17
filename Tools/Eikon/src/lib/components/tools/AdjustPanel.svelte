<script lang="ts">
import IconReset from "~icons/iconamoon/history";
import { tools } from "../../state/tools.svelte";
import Panel from "../ui/Panel.svelte";

const disabled = $derived(tools.sourceUrl === null);

type Key = "brightness" | "contrast" | "saturation" | "hue" | "temperature" | "sharpen";
const groups: {
  title: string;
  sliders: { key: Key; label: string; min: number; max: number; unit: string }[];
}[] = [
  {
    title: "色彩",
    sliders: [
      { key: "brightness", label: "亮度", min: 50, max: 150, unit: "%" },
      { key: "contrast", label: "对比度", min: 50, max: 150, unit: "%" },
      { key: "saturation", label: "饱和度", min: 50, max: 150, unit: "%" },
      { key: "hue", label: "色相", min: -180, max: 180, unit: "°" },
      { key: "temperature", label: "色温", min: -100, max: 100, unit: "" },
    ],
  },
  {
    title: "细节",
    sliders: [{ key: "sharpen", label: "锐化", min: 0, max: 100, unit: "" }],
  },
];

function fmt(key: Key, v: number, unit: string): string {
  if (key === "temperature") return v === 0 ? "中性" : v > 0 ? `暖 +${v}` : `冷 ${v}`;
  return `${v}${unit}`;
}
</script>

<Panel label="② 实时调整">
  <div class="adjust" class:dim={disabled}>
    {#each groups as g (g.title)}
      <section class="grp">
        <p class="grp-title">{g.title}</p>
        {#each g.sliders as s (s.key)}
          <div class="row">
            <div class="head">
              <label for={"adj-" + s.key}>{s.label}</label>
              <span class="val">{fmt(s.key, tools.adj[s.key], s.unit)}</span>
            </div>
            <input
              id={"adj-" + s.key}
              type="range"
              min={s.min}
              max={s.max}
              step="1"
              {disabled}
              bind:value={tools.adj[s.key]}
            />
          </div>
        {/each}
      </section>
    {/each}

    <section class="grp">
      <p class="grp-title">模式</p>
      <button
        type="button"
        class="toggle"
        class:on={tools.adj.grayscale}
        aria-pressed={tools.adj.grayscale}
        {disabled}
        onclick={() => (tools.adj.grayscale = !tools.adj.grayscale)}
      >
        <span class="dot"></span>
        黑白
      </button>
    </section>

    <button
      type="button"
      class="reset"
      {disabled}
      onclick={() => tools.resetAdjustments()}
    >
      <IconReset />
      重置全部
    </button>
  </div>
</Panel>

<style>
  .adjust {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }
  .adjust.dim {
    opacity: 0.5;
  }
  .grp {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }
  .grp-title {
    margin: 0;
    color: var(--c-soft);
    font: var(--t-eyebrow-weight) var(--t-eyebrow-size) var(--font-mono);
    letter-spacing: var(--t-eyebrow-ls);
    text-transform: uppercase;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  label {
    color: var(--c-ink);
    font-size: var(--t-body-sm-size);
  }
  .val {
    color: var(--c-body);
    background: var(--c-surface-2);
    border-radius: var(--r-sm);
    padding: 1px 8px;
    min-width: 44px;
    text-align: center;
    font: var(--t-caption-weight) var(--t-caption-size) var(--font-mono);
    letter-spacing: var(--t-caption-ls);
  }
  input[type="range"] {
    width: 100%;
    accent-color: var(--c-accent);
    cursor: pointer;
  }
  input[type="range"]:disabled {
    cursor: not-allowed;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-sm);
    align-self: flex-start;
    background: var(--c-surface-2);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-pill);
    padding: var(--sp-xs) var(--sp-md);
    color: var(--c-body);
    cursor: pointer;
    font: inherit;
    font-size: var(--t-body-sm-size);
    transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
  }
  .toggle .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--r-full);
    border: 1px solid var(--c-border-strong);
    background: transparent;
    transition: background 0.15s ease;
  }
  .toggle.on {
    border-color: var(--c-accent);
    color: var(--c-ink);
  }
  .toggle.on .dot {
    background: var(--c-accent);
    border-color: var(--c-accent);
  }
  .toggle:not(:disabled):hover {
    border-color: var(--c-border-strong);
    background: var(--c-surface-3);
  }
  .toggle:disabled {
    cursor: not-allowed;
  }
  .reset {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-xs);
    align-self: flex-start;
    background: transparent;
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-pill);
    padding: var(--sp-xs) var(--sp-md);
    color: var(--c-body);
    cursor: pointer;
    font: inherit;
    font-size: var(--t-body-sm-size);
    transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
  }
  .reset :global(svg) {
    width: 14px;
    height: 14px;
  }
  .reset:not(:disabled):hover {
    border-color: var(--c-border-strong);
    background: var(--c-surface-3);
    color: var(--c-ink);
  }
  .reset:disabled {
    cursor: not-allowed;
  }
</style>
