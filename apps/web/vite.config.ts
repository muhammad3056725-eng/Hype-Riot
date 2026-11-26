import { defineConfig } from "vite";

// Mount-agnostic static build (GitHub Pages project site or any subpath):
// relative base. The repo-level public/ folder (dataset under data/, the
// favicon) is served in dev and copied into dist/ on build.
export default defineConfig({
  base: "./",
  publicDir: "../../public",
  build: { outDir: "dist", assetsInlineLimit: 4096, target: "es2020" },
  // Keep paths as given (repos on subst/mapped drives would otherwise be
  // realpath'd to a different drive letter and fail to load in tests).
  resolve: { preserveSymlinks: true },
});
