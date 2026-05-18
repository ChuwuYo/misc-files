<script lang="ts">
import CropCanvas from "../components/panels/CropCanvas.svelte";
import SidePanel from "../components/panels/SidePanel.svelte";
import SizeLibrary from "../components/panels/SizeLibrary.svelte";
import SourcePanel from "../components/panels/SourcePanel.svelte";
import ThreeCol from "../components/ui/ThreeCol.svelte";
</script>

<ThreeCol>
  {#snippet left()}
    <SourcePanel />
    <SizeLibrary />
  {/snippet}
  {#snippet center()}
    <CropCanvas />
  {/snippet}
  {#snippet right()}
    <SidePanel />
  {/snippet}
</ThreeCol>
