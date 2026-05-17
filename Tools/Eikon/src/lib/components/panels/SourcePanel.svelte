<script lang="ts">
import { editor } from "../../state/editor.svelte";
import Uploader from "../ui/Uploader.svelte";

let fileName = $state<string | null>(null);

function onaccept(file: File) {
  fileName = file.name;
  editor.setSource(URL.createObjectURL(file));
}
function onclear() {
  editor.reset();
  fileName = null;
}
</script>

<Uploader
  label="① 来源"
  loaded={editor.sourceUrl !== null}
  {fileName}
  {onaccept}
  {onclear}
/>
