import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/* The API and the surface share an origin in production: FastAPI mounts
   `dist/` at `/`. In dev, Vite proxies `/v1` so there is still exactly one
   origin and no CORS decision to make. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": { target: process.env.API_ORIGIN ?? "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        /* The Beta renderer and the corpus-scale views are the only heavy
           chunks; keeping vendor separate keeps the examination route's
           payload from being re-downloaded on every deploy. */
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
