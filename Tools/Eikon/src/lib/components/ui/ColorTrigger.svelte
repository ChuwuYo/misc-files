<script lang="ts">
import IconPen from "~icons/iconamoon/pen";
// Custom trigger for svelte-awesome-color-picker (passed via
// components.input). Keeps our pill design — rainbow chip + "自定义" label —
// while the library provides the modern popup. Props mirror the library's
// default Input component contract.
interface Props {
  labelElement: HTMLLabelElement | undefined;
  hex: string | null;
  label: string;
  name?: string | undefined;
  dir: "ltr" | "rtl";
}

let { labelElement = $bindable(), hex, label, name = undefined, dir }: Props = $props();

const picked = $derived(!!hex && hex !== "#000000");

function preventDefault(e: MouseEvent) {
  // The library opens the popup; stop the native color dialog.
  e.preventDefault();
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<label
  bind:this={labelElement}
  class="trigger"
  onclick={preventDefault}
  onmousedown={preventDefault}
  {dir}
>
  <span
    class="chip"
    class:picked
    style:--picked={hex ?? "#000000"}
    aria-hidden="true"
  >
    <IconPen />
  </span>
  <span class="text">{label}</span>
  <input
    type="color"
    {name}
    value={hex}
    onclick={preventDefault}
    onmousedown={preventDefault}
    aria-haspopup="dialog"
  />
</label>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-xxs);
    height: 32px;
    padding: 0 10px 0 4px;
    border-radius: var(--r-full);
    border: 1px solid var(--c-hairline);
    background: var(--c-surface-1);
    color: var(--c-ink);
    font-size: var(--t-caption-size);
    cursor: pointer;
    user-select: none;
  }
  .chip {
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    aspect-ratio: 1;
    border-radius: 50%;
    overflow: hidden;
    display: grid;
    place-items: center;
    color: #fff;
    background: conic-gradient(
      hsl(0 90% 55%),
      hsl(60 90% 55%),
      hsl(120 90% 55%),
      hsl(180 90% 55%),
      hsl(240 90% 55%),
      hsl(300 90% 55%),
      hsl(360 90% 55%)
    );
  }
  .chip.picked {
    background: var(--picked);
  }
  .chip :global(svg) {
    width: 12px;
    height: 12px;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));
  }
  .text {
    white-space: nowrap;
  }
  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    border: none;
    padding: 0;
    margin: 0;
    pointer-events: none;
  }
</style>
