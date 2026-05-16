<script lang="ts">
import Panel from "../ui/Panel.svelte";
import { tools } from "../../state/tools.svelte";

const disabled = $derived(tools.sourceUrl === null);

const sliders = [
  { key: "brightness" as const, label: "亮度", min: 50, max: 150, unit: "%" },
  { key: "contrast" as const, label: "对比度", min: 50, max: 150, unit: "%" },
  { key: "saturation" as const, label: "饱和度", min: 50, max: 150, unit: "%" },
  { key: "sharpen" as const, label: "锐化", min: 0, max: 100, unit: "" },
];
</script>

<Panel label="② 实时调整">
  <div class="rows" class:dim={disabled}>
    {#each sliders as s (s.key)}
      <div class="row">
        <div class="head">
          <label for={"adj-" + s.key}>{s.label}</label>
          <span class="val">{tools.adj[s.key]}{s.unit}</span>
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
    <button
      type="button"
      class="reset"
      {disabled}
      onclick={() => tools.resetAdjustments()}
    >
      重置
    </button>
  </div>
</Panel>

<style>
  .rows { display: flex; flex-direction: column; gap: var(--sp-md); }
  .rows.dim { opacity: 0.5; }
  .row { display: flex; flex-direction: column; gap: var(--sp-xs); }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  label {
    color: var(--c-ink);
    font-size: var(--t-body-sm-size);
  }
  .val {
    color: var(--c-soft);
    font: var(--t-caption-weight) var(--t-caption-size) var(--font-mono);
    letter-spacing: var(--t-caption-ls);
  }
  input[type="range"] {
    width: 100%;
    accent-color: var(--c-accent);
    cursor: pointer;
  }
  input[type="range"]:disabled { cursor: not-allowed; }
  .reset {
    align-self: flex-start;
    background: transparent;
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-pill);
    padding: var(--sp-xs) var(--sp-md);
    color: var(--c-body);
    cursor: pointer;
    font: inherit;
    font-size: var(--t-body-sm-size);
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .reset:not(:disabled):hover { border-color: var(--c-soft); color: var(--c-ink); }
  .reset:disabled { cursor: not-allowed; }
</style>
