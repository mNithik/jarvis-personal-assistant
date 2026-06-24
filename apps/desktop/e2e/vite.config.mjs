import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const harnessDir = path.resolve(e2eDir, "harness");
const desktopSrcDir = path.resolve(e2eDir, "../src");

export default defineConfig({
  plugins: [react()],
  root: harnessDir,
  cacheDir: path.resolve(e2eDir, "node_modules/.vite"),
  resolve: {
    alias: {
      "@desktop": desktopSrcDir,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    fs: {
      allow: [harnessDir, desktopSrcDir, e2eDir],
    },
  },
});
