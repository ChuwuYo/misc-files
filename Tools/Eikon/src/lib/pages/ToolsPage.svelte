<script lang="ts">
import AdjustPanel from "../components/tools/AdjustPanel.svelte";
import CompressPanel from "../components/tools/CompressPanel.svelte";
import PreviewStage from "../components/tools/PreviewStage.svelte";
import ToolSource from "../components/tools/ToolSource.svelte";
</script>

<main class="cols">
  <div class="col left scroll-overlay">
    <ToolSource />
    <AdjustPanel />
  </div>
  <div class="col center"><PreviewStage /></div>
  <div class="col right scroll-overlay"><CompressPanel /></div>
</main>

<style>
  .cols {
    display: grid;
    grid-template-columns: 1fr 1.6fr 1fr;
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
    .col + .col {
      border-left: none;
      border-top: 1px solid var(--c-hairline);
    }
    .col.center {
      min-height: 60vh;
    }
  }
</style>
