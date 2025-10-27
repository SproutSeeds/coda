import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const rendererRoot = path.resolve(__dirname, "src/renderer");

export default defineConfig({
  root: rendererRoot,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "..", ".."),
      "@renderer": rendererRoot,
      "@ui": path.resolve(__dirname, "../../components/ui"),
      "@coda/runner-core": path.resolve(__dirname, "../../packages/runner-core/src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  css: {
    postcss: path.resolve(__dirname, "postcss.config.cjs"),
  },
});
