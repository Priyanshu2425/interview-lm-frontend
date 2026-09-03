/* Screenshot every route at desktop, tablet and phone, in whichever variation
   is asked for, and report any console error the page produced.

   Usage: node tools/shoot.mjs <out-dir> [theme] [--only=route,route] */
import { chromium } from "playwright";
import { requireApi, requireSurface } from "./preflight.mjs";
import { mkdir } from "node:fs/promises";

const BASE = process.env.BASE || "http://127.0.0.1:8000";
const out = process.argv[2] || "shots";
const theme = process.argv.find((a) => /^(graphite|paper|clinical|signal|dusk)$/.test(a)) || "graphite";
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");

const ROUTES = [
  ["mastery", "/mastery"],
  ["notebook", "/notebook"],
  ["notebook-workbench", `/notebook/${process.env.NOTEBOOK_ID || ""}`],
  ["session-setup", "/session/new"],
  ["sessions", "/session"],
  ["examination-live", `/examination/${process.env.SESSION_ID || ""}`],
  ["report-one", `/report/${process.env.SESSION_ID || ""}`],
  ["credits", "/credits"],
  ["settings", "/settings"],
  ["operator", "/operator"],
];

const SIZES = [
  ["desktop", 1440, 900],
  ["tablet", 900, 1100],
  ["phone", 390, 844],
];

await mkdir(out, { recursive: true });
await requireApi(BASE);
await requireSurface(BASE);

const browser = await chromium.launch();
const problems = [];

for (const [sizeName, width, height] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`${sizeName} pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return;
    problems.push(`${sizeName} console: ${t}`);
  });

  await page.goto(BASE + "/mastery", { waitUntil: "domcontentloaded" });
  await page.evaluate(({ t, sid }) => {
    localStorage.setItem("ilm.theme.v1", t);
    localStorage.setItem("ilm.candidate.v1", "cand_shoot_demo");
    if (sid) {
      localStorage.setItem("ilm.sessions.v1", JSON.stringify([{
        id: sid, startedAt: Date.now() - 12 * 60 * 1000,
        moduleCount: 4, durationSeconds: 3000, state: "running",
      }]));
    }
    sessionStorage.setItem("ilm.operator.v1", "dev-operator-token");
  }, { t: theme, sid: process.env.SESSION_ID || "" });

  for (const [name, route] of ROUTES) {
    if (only && !only.includes(name)) continue;
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `${out}/${name}.${sizeName}.${theme}.png`,
      fullPage: sizeName !== "phone",
    });
  }
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log("PROBLEMS:");
  for (const p of [...new Set(problems)]) console.log("  " + p);
} else {
  console.log("clean — no console errors");
}
