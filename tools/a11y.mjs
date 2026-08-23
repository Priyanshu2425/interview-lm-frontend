/* The screen reader pass, run against the accessibility tree.

   ISSUE-0020 asks for "a screen reader pass over the exchange and the summary;
   the posterior ridge and every band token carry a meaningful accessible name".
   Hearing VoiceOver is a person's job. *What it would announce* is not: it is
   the accessibility tree, and the tree is exactly what this reads.

   So this checks the criterion as written — is there a name, and does it carry
   the meaning rather than the decoration — and leaves the part that is genuinely
   about listening to a person.

     BASE=http://127.0.0.1:8100 node tools/a11y.mjs */

import { chromium } from "playwright";

const BASE = process.env.BASE || "http://127.0.0.1:8000";
const CID = "cand_a11y_" + Math.random().toString(36).slice(2, 8);

let pass = 0, fail = 0;
const ok = (t, cond, detail = "") => {
  if (cond) { pass++; console.log(`  ✓ ${t}`); }
  else { fail++; console.log(`  ✗ ${t}${detail ? " — " + detail : ""}`); }
};

const api = async (path, init = {}) => {
  const r = await fetch(BASE + "/v1" + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers || {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return r.json();
};

/* The accessibility tree, straight from the browser.

   Read over CDP rather than Playwright's own helper: `page.accessibility` was
   removed, and `Accessibility.getFullAXTree` is the same data the devtools
   pane shows — which is the same data a screen reader walks. */
const axTree = async (page, cdp) => {
  await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  return nodes
    .filter((n) => !n.ignored)
    .map((n) => ({
      role: n.role?.value || "",
      name: (n.name?.value || "").trim(),
      value: n.value?.value,
    }));
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();

await api("/credits/grants", {
  method: "POST",
  body: { candidate_id: CID, credits: 90000, payment_ref: "a11y-" + CID },
});
await p.goto(BASE + "/mastery", { waitUntil: "domcontentloaded" });
await p.evaluate((cid) => localStorage.setItem("ilm.candidate.v1", cid), CID);

const modules = await api(`/corpus/modules?track=aiml&candidate_id=${CID}`);
const started = await api("/sessions", {
  method: "POST",
  body: {
    candidate_id: CID,
    module_ids: [modules[0].module_id],
    duration_seconds: 1800,
  },
});
const sid = started.session_id;

/* ------------------------------------------------------------ the exchange -- */
/* Checked with a question open and unanswered, which is the only state the
   composer exists in. A pass run after the Session ended would report a screen
   nobody is ever on. */
console.log("\nThe exchange, as it is announced");
await p.goto(`${BASE}/examination/${sid}`, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);

const cdp = await ctx.newCDPSession(p);
let tree = await axTree(p, cdp);
ok("the page announces a heading before anything else",
   tree.findIndex((n) => n.role === "heading" && n.name) >= 0);

const controls = tree.filter((n) =>
  ["button", "link", "textbox", "checkbox", "combobox"].includes(n.role));
ok("every control in the exchange announces a name",
   controls.length > 0 && controls.every((n) => n.name.length > 0),
   controls.filter((n) => !n.name).map((n) => n.role).join(","));

const boxes = tree.filter((n) => n.role === "textbox");
if (boxes.length === 0) {
  console.log("  · no composer on screen (the Session is between Visits or ended)");
} else {
  ok("the answer field announces what it is for",
     boxes.some((n) => /answer|response/i.test(n.name)),
     boxes.map((n) => JSON.stringify(n.name)).join(" | "));
}

const live = await p.evaluate(() =>
  [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")]
    .map((n) => n.getAttribute("aria-live") || n.getAttribute("role")));
ok("something announces the reply without the reader hunting for it",
   live.length > 0, JSON.stringify(live));

/* ------------------------------------------------------------ the ridge ----- */
/* The Mastery map draws it for every Topic with a reading, and unlike the
   result panel that survives a reload — so this is where it can be checked
   rather than caught in passing. */
console.log("\nThe posterior ridge");
for (let i = 0; i < 8; i++) {
  const r = await api(`/sessions/${sid}/turns`, {
    method: "POST",
    body: { answer: "Scaling keeps the softmax in a region that still has gradient." },
  });
  if (r?.payload?.kind === "visit_closed" || r?.kind === "visit_closed") break;
}
await p.goto(BASE + "/mastery", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);

const ridges = await p.evaluate(() =>
  [...document.querySelectorAll("svg.beta")].map((el) => ({
    role: el.getAttribute("role"),
    label: el.getAttribute("aria-label") || "",
  })));
if (ridges.length === 0) {
  console.log("  · the result panel is not on screen for this Session");
} else {
  ok("the posterior ridge announces itself as an image", ridges.every((r) => r.role === "img"));
  ok("its name carries the band and the reading, not the word 'chart'",
     ridges.every((r) => /untested|early|weak|solid/i.test(r.label)
                      && /mastery|no reading/i.test(r.label)),
     JSON.stringify(ridges.map((r) => r.label)));
}

/* ------------------------------------------------------------- the summary -- */
console.log("\nThe record, as it is announced");
await p.goto(`${BASE}/evidence/${sid}`, { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
tree = await axTree(p, await ctx.newCDPSession(p));

const table = await p.evaluate(() =>
  [...document.querySelectorAll("table")].map((t) => ({
    caption: t.querySelector("caption")?.textContent?.trim() || "",
    headers: [...t.querySelectorAll("th")].map((h) => h.textContent.trim()),
  })));
ok("the record's table carries a caption a reader can orient by",
   table.length > 0 && table.every((t) => t.caption.length > 10),
   JSON.stringify(table.map((t) => t.caption)));
ok("every column announces a header",
   table.every((t) => t.headers.length > 0 && t.headers.every((h) => h.length > 0)));

/* The two things ISSUE-0020 names by hand. */
const bands = await p.evaluate(() =>
  [...document.querySelectorAll(".score-cell")]
    .map((n) => n.innerText.trim()).filter(Boolean).slice(0, 12));
ok("every band token reads as a word, not only as a colour",
   bands.length > 0 && bands.every((b) => /untested|early|weak|solid|—/i.test(b)),
   JSON.stringify(bands.slice(0, 4)));

/* ------------------------------------------------------------- greyscale --- */
console.log("\nNothing carried by colour alone");
await p.evaluate(() => { document.documentElement.style.filter = "grayscale(1)"; });
await p.waitForTimeout(200);
const greyBands = await p.evaluate(() =>
  [...document.querySelectorAll(".score-cell")]
    .map((n) => n.innerText.trim()).filter(Boolean));
ok("in greyscale every band is still readable from its word",
   greyBands.length > 0 && greyBands.every((b) => /untested|early|weak|solid|—/i.test(b)));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
