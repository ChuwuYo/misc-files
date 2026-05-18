<script lang="ts">
import { fmtBytes } from "../../domain/bytes";
import { tools } from "../../state/tools.svelte";
import Uploader from "../ui/Uploader.svelte";

let fileName = $state<string | null>(null);

const meta = $derived(
  tools.sourceUrl !== null ? `原始大小 · ${fmtBytes(tools.sourceBytes)}` : undefined,
);

function onaccept(file: File) {
  fileName = file.name;
  tools.setSource(URL.createObjectURL(file), file.size);
}
function onclear() {
  tools.reset();
  fileName = null;
}
</script>

<Uploader
  label="① 图片来源"
  loaded={tools.sourceUrl !== null}
  {fileName}
  {meta}
  {onaccept}
  {onclear}
/>
