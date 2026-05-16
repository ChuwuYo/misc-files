<script lang="ts">
import ToolSource from "../components/tools/ToolSource.svelte";
import AdjustPanel from "../components/tools/AdjustPanel.svelte";
import CompressPanel from "../components/tools/CompressPanel.svelte";
import PreviewStage from "../components/tools/PreviewStage.svelte";
</script>

<main class="cols">
  <div class="col left scroll-overlay">
    <ToolSource />
    <AdjustPanel />
    <CompressPanel />
  </div>
  <div class="col right"><PreviewStage /></div>
</main>

<style>
  .cols {
    display: grid;
    grid-template-columns: 1fr 1.8fr;
    height: calc(100vh - 56px);
  }
  .col { min-width: 0; }
  .col.left {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .col.right { border-left: 1px solid var(--c-hairline); }
  @media (max-width: 960px) {
    .cols {
      grid-template-columns: 1fr;
      height: auto;
      min-height: calc(100vh - 56px);
    }
    .col.right {
      border-left: none;
      border-top: 1px solid var(--c-hairline);
      min-height: 60vh;
    }
  }
</style>
