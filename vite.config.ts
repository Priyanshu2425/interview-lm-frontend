import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/* The development certificate, if this machine has one.
 *
 * Gatehouse's refresh cookie is `Secure`, so a browser will not send it over plain
 * http — and this tenant's front end is same-site with the auth host, so the cookie
 * is exactly what it should be using. https locally is what makes that work, and it
 * needs a certificate the browser trusts for this name.
 *
 *   brew install mkcert && mkcert -install
 *   mkdir -p ~/.local/share/gatehouse-dev-certs
 *   cd ~/.local/share/gatehouse-dev-certs
 *   mkcert -cert-file dev.buildspacelabs.com.pem \
 *          -key-file  dev.buildspacelabs.com-key.pem \
 *          "*.dev.buildspacelabs.com" "dev.buildspacelabs.com"
 *
 * Absent, the server still starts on plain http. Everything but signing in works,
 * and the sign-in failure is then one missing certificate rather than a dev server
 * that would not come up at all.
 */
function developmentCertificate() {
  const dir = join(homedir(), ".local", "share", "gatehouse-dev-certs");
  const key = join(dir, "dev.buildspacelabs.com-key.pem");
  const cert = join(dir, "dev.buildspacelabs.com.pem");
  if (!existsSync(key) || !existsSync(cert)) {
    console.warn(
      "\n  No development certificate found, so this server is plain http and the\n" +
      "  refresh cookie will not be sent — sign-in will appear to work and the\n" +
      "  session will vanish on the next reload. See the README.\n",
    );
    return undefined;
  }
  return { key: readFileSync(key), cert: readFileSync(cert) };
}


/* The API and the surface share an origin in production: FastAPI mounts
   `dist/` at `/`. In dev, Vite proxies `/v1` so there is still exactly one
   origin and no CORS decision to make. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    /* Gatehouse gives every tenant its own development hostname, because an origin
       belongs to exactly one tenant and every product's developers would otherwise
       want `localhost:5173`. The label is this tenant's slug; the name resolves to
       127.0.0.1 and nothing leaves the machine.

       `strictPort` matters here: without it a busy 5173 moves Vite to 5174 — which
       is Attest's — and the failure arrives as an unreadable CORS refusal instead of
       one line from the dev server. */
    host: "interview-lm.dev.buildspacelabs.com",
    https: developmentCertificate(),
    port: 5173,
    strictPort: true,
    allowedHosts: ["interview-lm.dev.buildspacelabs.com"],
    proxy: {
      "/v1": { target: process.env.API_ORIGIN ?? "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  /* The dictation worker pulls Transformers.js in through a dynamic `import()`,
     so those megabytes are fetched by somebody about to speak and by nobody
     else. Vite's default worker format is `iife`, which cannot do dynamic
     imports at all — without this the build fails outright. */
  worker: { format: "es" },
  optimizeDeps: {
    /* The package's browser entry is one pre-bundled multi-megabyte file.
       Dep-optimising it is slow and rewrites the
       `new URL(..., import.meta.url)` patterns the ONNX runtime uses to locate
       its own wasm, which surfaces in dev as a full page reload the first time
       a worker is spawned. */
    exclude: ["@huggingface/transformers"],
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        /* The Beta renderer and the corpus-scale views are the only heavy
           chunks; keeping vendor separate keeps the examination route's
           payload from being re-downloaded on every deploy.

           Transformers.js is deliberately absent. It is only ever reached from
           inside the worker, which Vite emits as its own asset outside this
           graph — naming it here would pull it back into the main one and
           undo the whole point of the worker. */
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
