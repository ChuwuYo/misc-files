<script lang="ts">
import SourcePanel from "../components/panels/SourcePanel.svelte";
import SizeLibrary from "../components/panels/SizeLibrary.svelte";
import CropCanvas from "../components/panels/CropCanvas.svelte";
import SidePanel from "../components/panels/SidePanel.svelte";
</script>

<main class="cols">
  <div class="col left scroll-overlay">
    <SourcePanel />
    <SizeLibrary />
  </div>
  <div class="col center scroll-overlay"><CropCanvas /></div>
  <div class="col right scroll-overlay"><SidePanel /></div>
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
    min-height: 0; /* allow children to shrink so the column can scroll */
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
  }
</style>
