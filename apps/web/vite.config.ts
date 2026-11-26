import { defineConfig } from "vite";

// Mount-agnostic static build (GitHub Pages project site or any subpath):
// relative base, dataset copied beside dist at deploy time.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", assetsInlineLimit: 0 },
});
