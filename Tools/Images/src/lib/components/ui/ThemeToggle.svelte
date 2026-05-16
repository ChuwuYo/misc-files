<script lang="ts">
import IconSun from "~icons/iconamoon/mode-light";
import IconMoon from "~icons/iconamoon/mode-dark";
import { theme } from "../../state/theme.svelte";

const isLight = $derived(theme.mode === "light");
</script>

<button
  class="toggle"
  onclick={() => theme.toggle()}
  aria-label={isLight ? "当前亮色，点击切换暗色" : "当前暗色，点击切换亮色"}
  title="切换主题"
>
  {#if isLight}
    <IconSun />
  {:else}
    <IconMoon />
  {/if}
</button>

<style>
  .toggle {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    background: var(--c-surface-2);
    color: var(--c-ink);
    border: 1px solid var(--c-hairline);
    border-radius: var(--r-full);
    cursor: pointer;
    font-size: 16px;
    line-height: 0;
  }
  .toggle :global(svg) {
    width: 1em;
    height: 1em;
  }
</style>
