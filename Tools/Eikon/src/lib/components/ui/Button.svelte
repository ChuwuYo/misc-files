<script lang="ts">
/** Pill button — DESIGN.md: every CTA is a pill. */
let {
  variant = "primary",
  children,
  ...rest
}: { variant?: "primary" | "ghost"; children: import("svelte").Snippet } & Record<
  string,
  unknown
> = $props();
</script>

<button class="btn {variant}" {...rest}>{@render children()}</button>

<style>
  .btn {
    font: var(--t-button-weight) var(--t-button-size) / var(--t-button-lh) var(--font-sans);
    letter-spacing: var(--t-button-ls);
    border-radius: var(--r-pill);
    padding: 10px 20px;
    border: none;
    cursor: pointer;
    width: 100%;
  }
  .primary { background: var(--c-accent); color: var(--c-on-accent); }
  .ghost {
    background: transparent;
    color: var(--c-ink);
    border: 1px solid var(--c-hairline);
  }
</style>
