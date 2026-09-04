/* Every tool in here drives a real browser against a real API. When nothing is
   listening, say so in one line and name the command that fixes it — a stack
   trace from deep inside Playwright is a worse answer to "is the server up?"
   than the question deserves.

   **Two origins, not one.** These tools used to point everything at the API,
   because the API served the surface at `/`. ADR-0020 ended that: the surface
   is built and served separately and reaches the API cross-origin. So `BASE`
   is the API and `SURFACE` is where the pages are — a tool navigating to the
   API's origin got a JSON 404 and reported it as a missing screen. */

import https from "node:https";
import http from "node:http";

/** The API. Requests go here. */
export const BASE = (process.env.BASE || "http://127.0.0.1:8000").replace(/\/$/, "");

/** The surface. Pages are opened here.
 *
 *  The dev server, and not `localhost`, because Gatehouse's refresh cookie is
 *  `SameSite=Lax` and `Secure` — it is only sent from an origin that is the
 *  same site as the auth host and served over https.
 *  `backend/scripts/dev-auth-setup.sh` is what makes this name resolve and its
 *  certificate trusted. */
export const SURFACE =
  (process.env.SURFACE || "https://interview-lm.dev.buildspacelabs.com:5173").replace(/\/$/, "");

/** Every browser context needs this.
 *
 *  The development certificate is real and issued by an authority this machine
 *  trusts; Chromium, launched fresh by Playwright with an empty profile, has
 *  never heard of it. */
export const CONTEXT = { ignoreHTTPSErrors: true };

export async function requireApi(base = BASE) {
  try {
    const r = await fetch(base + "/v1/health", { signal: AbortSignal.timeout(3000) });
    if (r.ok) return;
    console.error(`\nThe API answered ${r.status} at ${base}/v1/health.\n`);
  } catch {
    console.error(
      `\nNothing is listening on ${base}.\n\n` +
      `Start it from the project root:\n\n` +
      `  .venv/bin/uvicorn interviewer.app:app --port 8000 --env-file backend/.env\n\n` +
      `Point these tools elsewhere with BASE=http://host:port.\n`,
    );
  }
  process.exit(1);
}

/** A GET that tolerates the development certificate.
 *
 *  `fetch` will not: the dev server's certificate is issued by a local
 *  authority this machine trusts and Node does not, so a running surface came
 *  back as "nothing is listening" — a preflight lying about the thing it
 *  exists to check. Scoped to this one probe rather than
 *  `NODE_TLS_REJECT_UNAUTHORIZED=0`, which would also stop verifying
 *  Gatehouse. */
function getInsecure(url) {
  return new Promise((resolve) => {
    const { request } = url.startsWith("https:") ? https : http;
    const req = request(url, { rejectUnauthorized: false, timeout: 5000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { body += c; });
      res.on("end", () => resolve({ ok: res.statusCode < 400, body }));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/* A surface that is not being served is a different failure from a dead API and
   gets its own sentence.

   This used to check the API's own origin and, on failing, tell you to set
   `SURFACE_DIR`. That advice could not work: the mount the variable configured
   went with ADR-0020 and only the configuration was left behind, so nothing
   reads it and no value would have helped. */
export async function requireSurface(surface = SURFACE) {
  const r = await getInsecure(surface + "/");
  const html = r && r.ok ? r.body : "";
  if (html.includes('id="root"')) return;
  console.error(
    `\nNo surface at ${surface}.\n\n` +
    `Start it from frontend/:\n\n  npm run dev\n\n` +
    `That host is not localhost on purpose — Gatehouse's refresh cookie needs an\n` +
    `https origin that is same-site with the auth host, which is what\n` +
    `backend/scripts/dev-auth-setup.sh sets up. Point elsewhere with\n` +
    `SURFACE=https://host:port.\n`,
  );
  process.exit(1);
}
