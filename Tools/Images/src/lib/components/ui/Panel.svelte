<script lang="ts">
/** Column panel shell with a mono eyebrow label. */
let { label, children }: { label: string; children: import("svelte").Snippet } = $props();
</script>

<section class="panel">
  <p class="eyebrow">{label}</p>
  {@render children()}
</section>

<style>
  .panel { padding: var(--sp-md); min-width: 0; }
  .eyebrow {
    font: var(--t-eyebrow-weight) var(--t-eyebrow-size) var(--font-mono);
    letter-spacing: var(--t-eyebrow-ls);
    text-transform: uppercase;
    color: var(--c-soft);
    margin: 0 0 var(--sp-sm);
  }
</style>
