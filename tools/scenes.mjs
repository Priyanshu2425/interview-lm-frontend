/* Interaction states the route-level shoot cannot reach: an expanded Evidence
   row, a graded Visit, the Settings save bar, the mobile drawer, a dialog. */
import { chromium } from "playwright";
import { requireApi, requireSurface } from "./preflight.mjs";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE || "http://127.0.0.1:8000";
const SID = process.env.SESSION_ID;
const out = process.argv[2] || "scenes";
const theme = process.argv[3] || "graphite";
await mkdir(out, { recursive: true });

await requireApi(BASE);
await requireSurface(BASE);

const browser = await chromium.launch();
const problems = [];

async function page(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      problems.push("console: " + m.text());
  });
  await p.goto(BASE + "/mastery", { waitUntil: "domcontentloaded" });
  await p.evaluate(({ t, sid }) => {
    localStorage.setItem("ilm.theme.v1", t);
    localStorage.setItem("ilm.candidate.v1", "cand_shoot_demo");
    localStorage.setItem("ilm.sessions.v1", JSON.stringify([{
      id: sid, startedAt: Date.now() - 12 * 60 * 1000,
      moduleCount: 4, durationSeconds: 3000, state: "running",
    }]));
  }, { t: theme, sid: SID });
  return { ctx, p };
}

/* 1 — an Evidence row opened onto its grounding */
{
  const { ctx, p } = await page(1440, 900);
  await p.goto(`${BASE}/evidence/${SID}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.locator(".row-toggle").first().click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/evidence-open.${theme}.png` });
  await ctx.close();
}

/* 2 — a Visit graded: the dial, the posterior, the blind grade.
      Runs on a Session of its own so the state is always "a question is open". */
{
  const api = async (path, init = {}) => {
    const r = await fetch(BASE + "/v1" + path, {
      method: init.method || "GET",
      headers: { "content-type": "application/json", ...(init.headers || {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const t = await r.text();
    if (!r.ok) throw new Error(`${path} → ${r.status} ${t.slice(0, 200)}`);
    return t ? JSON.parse(t) : null;
  };
  const mods = await api("/corpus/modules?track=aiml&candidate_id=cand_shoot_demo");
  const fresh = await api("/sessions", { method: "POST", body: {
    candidate_id: "cand_shoot_demo",
    module_ids: mods.filter((m) => m.selectable !== false).slice(0, 3).map((m) => m.module_id),
    duration_seconds: 3000, provider: "deepseek" } });

  const { ctx, p } = await page(1440, 900);
  await p.evaluate((sid) => {
    localStorage.setItem("ilm.sessions.v1", JSON.stringify([{
      id: sid, startedAt: Date.now() - 4 * 60 * 1000,
      moduleCount: 3, durationSeconds: 3000, state: "running",
    }]));
  }, fresh.session_id);
  await p.goto(`${BASE}/examination/${fresh.session_id}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const box = p.locator("#answer");
  if (await box.count()) {
    await box.fill("Masking is added to the logits before the softmax, so masked positions go to negative infinity and get exactly zero weight after normalisation.");
    await p.getByRole("button", { name: "Submit answer" }).click();
    await p.waitForTimeout(2500);
  }
  await p.screenshot({ path: `${out}/visit-result.${theme}.png` });
  /* the confirm dialog */
  const end = p.getByRole("button", { name: /^End Session$/ });
  if (await end.count()) {
    await end.click();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/end-dialog.${theme}.png` });
    await p.keyboard.press("Escape");
  }
  await ctx.close();
}

/* 3 — Settings with unsaved changes */
{
  const { ctx, p } = await page(1440, 900);
  await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.getByText("25 minutes").click();
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/settings-dirty.${theme}.png` });
  await ctx.close();
}

/* 4 — the mobile drawer */
{
  const { ctx, p } = await page(390, 844);
  await p.goto(BASE + "/mastery", { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Open menu" }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/drawer.${theme}.png` });
  await ctx.close();
}

/* 5 — the session picker with a scope chosen */
{
  const { ctx, p } = await page(1440, 900);
  await p.goto(BASE + "/session/new", { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const rows = p.locator("label.scope-item");
  const n = Math.min(3, await rows.count());
  for (let i = 0; i < n; i++) await rows.nth(i).locator(".check-box").click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/setup-chosen.${theme}.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
if (problems.length) { console.log("PROBLEMS:"); for (const x of [...new Set(problems)]) console.log("  " + x); }
else console.log("clean — no console errors");
