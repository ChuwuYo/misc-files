<script lang="ts">
import type { Snippet } from "svelte";

// Single source of truth for the 3-column page layout (maker & tools),
// so the two pages can't drift in grid/responsive behavior.
let { left, center, right }: { left: Snippet; center: Snippet; right: Snippet } = $props();
</script>

<main class="cols">
  <div class="col scroll-overlay">{@render left()}</div>
  <div class="col center scroll-overlay">{@render center()}</div>
  <div class="col scroll-overlay">{@render right()}</div>
</main>

<style>
  .cols {
    display: grid;
    grid-template-columns: 1fr 1.6fr 1fr;
    /* Fixed viewport height so each column scrolls independently
       instead of the whole page growing tall. */
    height: calc(100vh - 56px);
  }
  .col {
    min-width: 0;
    min-height: 0;
  }
  .col + .col {
    border-left: 1px solid var(--c-hairline);
  }
  @media (max-width: 960px) {
    .cols {
      grid-template-columns: 1fr;
      height: auto;
      min-height: calc(100vh - 56px);
    }
    .col {
      overflow: visible;
    }
    .col + .col {
      border-left: none;
      border-top: 1px solid var(--c-hairline);
    }
    .col.center {
      min-height: 60vh;
    }
  }
</style>
