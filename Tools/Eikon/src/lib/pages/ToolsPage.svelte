<script lang="ts">
import AdjustPanel from "../components/tools/AdjustPanel.svelte";
import CompressPanel from "../components/tools/CompressPanel.svelte";
import PreviewStage from "../components/tools/PreviewStage.svelte";
import ToolSource from "../components/tools/ToolSource.svelte";
import ThreeCol from "../components/ui/ThreeCol.svelte";
</script>

<ThreeCol>
  {#snippet left()}
    <ToolSource />
    <AdjustPanel />
  {/snippet}
  {#snippet center()}
    <PreviewStage />
  {/snippet}
  {#snippet right()}
    <CompressPanel />
  {/snippet}
</ThreeCol>
