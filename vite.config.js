import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The dev server listens on all interfaces so the cloud preview can reach it.
 * VITE_PREVIEW_HOST is set by the host environment (or locally) to the single
 * preview hostname that should be accepted; nothing is blanket-allowed.
 */
const previewHost = process.env.VITE_PREVIEW_HOST;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: previewHost ? [previewHost] : [],
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
});
