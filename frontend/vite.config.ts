import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: { output: { manualChunks: { charts: ["recharts"] } } },
  },
  server: { proxy: { "/api": "http://localhost:8080" } },
  preview: { proxy: { "/api": "http://localhost:8080" } },
  test: { environment: "jsdom", setupFiles: "./src/test-setup.ts", css: false },
});
