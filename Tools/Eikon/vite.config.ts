import { svelte } from "@sveltejs/vite-plugin-svelte";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";

// Cross-origin isolation — enables WASM multi-threading (SharedArrayBuffer)
// so ONNX (AI cutout) runs multi-threaded instead of falling back to a slow
// single thread. All assets are same-origin (local public/imgly, bundled
// wasm), so COEP: require-corp is safe here. NOTE: production hosting must
// send these two headers as well.
const coopCoep = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

// https://vite.dev/config/
export default defineConfig({
  server: { headers: coopCoep },
  preview: { headers: coopCoep },
  // IconaMoon icons are compiled to inline SVG Svelte components at build
  // time (offline, no runtime API fetch — fits the local-only privacy goal).
  plugins: [svelte(), Icons({ compiler: "svelte", autoInstall: false })],
  // jSquash / imgly ship wasm + workers; excluding them from dep
  // pre-bundling keeps their lazy dynamic imports as separate chunks.
  optimizeDeps: {
    exclude: ["@jsquash/oxipng", "@jsquash/jpeg", "@jsquash/png", "@imgly/background-removal"],
  },
});
