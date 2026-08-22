/* Every tool in here drives a real browser against a real API. When nothing is
   listening, say so in one line and name the command that fixes it — a stack
   trace from deep inside Playwright is a worse answer to "is the server up?"
   than the question deserves. */

export async function requireApi(base) {
  try {
    const r = await fetch(base + "/v1/health", { signal: AbortSignal.timeout(3000) });
    if (r.ok) return;
    console.error(`\nThe API answered ${r.status} at ${base}/v1/health.\n`);
  } catch {
    console.error(
      `\nNothing is listening on ${base}.\n\n` +
      `Start it from the project root:\n\n` +
      `  INTERVIEWER_FAKE_MODEL=1 .venv/bin/uvicorn interviewer.api.app:app --port 8000\n\n` +
      `Point these tools elsewhere with BASE=http://host:port.\n`,
    );
  }
  process.exit(1);
}

/* The surface is served from dist/, so a stale or absent build is a different
   failure from a dead server and gets its own sentence. */
export async function requireSurface(base) {
  const r = await fetch(base + "/", { signal: AbortSignal.timeout(3000) }).catch(() => null);
  const html = r && r.ok ? await r.text() : "";
  if (html.includes('id="root"')) return;
  console.error(
    `\nThe API is up but is not serving the surface at ${base}/.\n\n` +
    `Build it:\n\n  npm run build\n\n` +
    `Or point SURFACE_DIR at the build you want served.\n`,
  );
  process.exit(1);
}
