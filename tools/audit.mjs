/* What a screenshot cannot tell you: measured contrast on every rendered text
   node, touch-target sizes, focus visibility, ARIA wiring, and whether the
   page scrolls sideways at 320px.

   Run against a live server: node tools/audit.mjs */
import { chromium } from "playwright";
import { requireApi, requireSurface } from "./preflight.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:8000";
const SID = process.env.SESSION_ID || "";
const THEMES = ["graphite", "paper", "clinical", "signal", "dusk"];
const ROUTES = [
  "/mastery", "/notebook", "/session/new", "/examination",
  `/evidence/${SID}`, "/credits", "/settings", "/operator",
];

const AUDIT = `(() => {
  const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = ([r, g, b]) => 0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
  const parse = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a));
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };

  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.92) return c.rgb;
      n = n.parentElement;
    }
    const c = parse(getComputedStyle(document.body).backgroundColor);
    return c ? c.rgb : [0, 0, 0];
  };

  const out = { contrast: [], targets: [], aria: [], overflow: null };

  document.querySelectorAll("body *").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.4) return;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("").trim();
    if (!text) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const fg = parse(cs.color);
    if (!fg) return;
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const got = ratio(over(fg, bgOf(el)), bgOf(el));
    if (got < need) {
      out.contrast.push({
        sel: el.tagName.toLowerCase() + "." + (el.className || "").toString().split(" ").slice(0, 2).join("."),
        text: text.slice(0, 40), px, ratio: +got.toFixed(2), need,
      });
    }
  });

  document.querySelectorAll("button, a[href], input, select, textarea, [role=tab], [role=radio]").forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    /* WCAG 2.5.8 "Equivalent" exception, taken deliberately and only here: a
       corpus map mark is 15px on a pointing device because 75 cells at 24px
       stop being one wall of Topics. Every mark that opens something also has
       a full-width row in the Topic list on the same screen, and on a coarse
       pointer the mark's hit box grows to 24px. */
    if (!matchMedia("(pointer: coarse)").matches && el.closest(".heat")) return;
    if (r.height < 24 || r.width < 24) {
      out.targets.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().split(" ")[0],
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30),
        w: Math.round(r.width), h: Math.round(r.height),
      });
    }
  });

  document.querySelectorAll("button, a").forEach((el) => {
    const name = (el.getAttribute("aria-label") || el.textContent || "").trim();
    const r = el.getBoundingClientRect();
    if (!name && r.width > 0) {
      out.aria.push({ tag: el.tagName.toLowerCase(), cls: (el.className || "").toString().split(" ")[0] });
    }
  });
  document.querySelectorAll("img:not([alt]), svg:not([aria-hidden]):not([role])").forEach((el) => {
    if (el.closest("[aria-hidden=true]")) return;
    out.aria.push({ tag: el.tagName.toLowerCase(), issue: "no accessible name or aria-hidden" });
  });

  out.overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return out;
})()`;

await requireApi(BASE);
await requireSurface(BASE);

const browser = await chromium.launch();
let failures = 0;

for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + "/mastery", { waitUntil: "domcontentloaded" });
  await p.evaluate((t) => {
    localStorage.setItem("ilm.theme.v1", t);
    localStorage.setItem("ilm.candidate.v1", "cand_shoot_demo");
    sessionStorage.setItem("ilm.operator.v1", "dev-operator-token");
  }, theme);

  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    await p.waitForTimeout(350);
    const r = await p.evaluate(AUDIT);
    const label = `${theme.padEnd(9)} ${route}`;
    if (r.contrast.length) {
      failures += r.contrast.length;
      console.log(`✗ ${label} — ${r.contrast.length} contrast`);
      for (const c of r.contrast.slice(0, 6)) console.log(`    ${c.ratio} (need ${c.need}) ${c.px}px  ${c.sel}  "${c.text}"`);
    }
    if (r.targets.length) {
      failures += r.targets.length;
      console.log(`✗ ${label} — ${r.targets.length} small targets`);
      for (const t of r.targets.slice(0, 6)) console.log(`    ${t.w}x${t.h}  ${t.tag}.${t.cls}  "${t.label}"`);
    }
    if (r.aria.length) {
      failures += r.aria.length;
      console.log(`✗ ${label} — ${r.aria.length} unnamed`);
      for (const a of r.aria.slice(0, 6)) console.log(`    ${JSON.stringify(a)}`);
    }
  }
  await ctx.close();
}

/* Touch: every target, including the ones the desktop pass excuses. */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.goto(BASE + "/mastery", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => {
    localStorage.setItem("ilm.candidate.v1", "cand_shoot_demo");
    sessionStorage.setItem("ilm.operator.v1", "dev-operator-token");
  });
  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    await p.waitForTimeout(300);
    const r = await p.evaluate(AUDIT);
    if (r.targets.length) {
      failures += r.targets.length;
      console.log(`✗ touch ${route} — ${r.targets.length} small targets`);
      for (const t of r.targets.slice(0, 6)) console.log(`    ${t.w}x${t.h}  ${t.tag}.${t.cls}  "${t.label}"`);
    }
    if (r.contrast.length) {
      failures += r.contrast.length;
      console.log(`✗ touch ${route} — ${r.contrast.length} contrast`);
      for (const c of r.contrast.slice(0, 4)) console.log(`    ${c.ratio} (need ${c.need}) ${c.px}px "${c.text}"`);
    }
  }
  await ctx.close();
}

/* Narrow viewport: nothing may push the page sideways. */
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 } });
  const p = await ctx.newPage();
  for (const route of ROUTES) {
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    await p.waitForTimeout(250);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) { failures++; console.log(`✗ 320px ${route} — page scrolls sideways by ${over}px`); }
  }
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\nAUDIT CLEAN" : `\n${failures} findings`);
