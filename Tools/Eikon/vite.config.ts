import { svelte } from "@sveltejs/vite-plugin-svelte";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // IconaMoon icons are compiled to inline SVG Svelte components at build
  // time (offline, no runtime API fetch — fits the local-only privacy goal).
  plugins: [svelte(), Icons({ compiler: "svelte", autoInstall: false })],
  // jSquash / imgly ship wasm + workers; excluding them from dep
  // pre-bundling keeps their lazy dynamic imports as separate chunks.
  optimizeDeps: {
    exclude: [
      "@jsquash/oxipng",
      "@jsquash/jpeg",
      "@jsquash/png",
      "@imgly/background-removal",
      "@silvia-odwyer/photon",
    ],
  },
});
