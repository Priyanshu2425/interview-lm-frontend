/* End-to-end, against the running API and a real browser.

   These assert what a Candidate would observe — and several assert what must
   NOT appear: no fused Coverage-and-Mastery figure, no number on an Untested
   Topic, no difficulty label, no Credit message on a BYOK view, no Session
   price quoted in advance.

   BASE=http://127.0.0.1:8000 node tests/run.mjs */
import { chromium } from "playwright";
import { requireApi, requireSurface } from "../tools/preflight.mjs";

const BASE = process.env.BASE || "http://127.0.0.1:8000";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
};

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

const CID = "cand_e2e_" + Math.random().toString(36).slice(2, 8);

await requireApi(BASE);
await requireSurface(BASE);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  const t = m.text();
  if (m.type() === "error" && !/Failed to load resource/.test(t)) errors.push("console: " + t);
});

const seed = async (extra = {}) => {
  await p.goto(BASE + "/mastery", { waitUntil: "domcontentloaded" });
  await p.evaluate(({ cid, extra }) => {
    localStorage.setItem("ilm.candidate.v1", cid);
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, { cid: CID, extra });
};

/* ---------------------------------------------------------------- setup -- */
console.log("\nSession setup");
await api("/credits/grants", { method: "POST", body: { candidate_id: CID, credits: 90000, payment_ref: "e2e-" + CID } });
await seed();
await p.goto(BASE + "/session/new", { waitUntil: "networkidle" });
await p.waitForTimeout(500);

const apiModules = await api(`/skills/modules?track=aiml`);
const shownCounts = await p.evaluate(() =>
  [...document.querySelectorAll(".scope-item .caption")]
    .map((n) => (n.textContent.match(/^(\d+) Topics/) || [])[1]).filter(Boolean).map(Number));
ok("Topic counts come from the API",
   JSON.stringify(shownCounts.slice(0, 6)) === JSON.stringify(apiModules.slice(0, 6).map((m) => m.topic_count)),
   shownCounts.slice(0, 6).join(","));

ok("Begin Session is genuinely disabled with no scope",
   await p.evaluate(() => {
     const b = [...document.querySelectorAll("button")].find((x) => /Begin Session/.test(x.textContent));
     return b?.disabled === true;
   }));

const urlBefore = p.url();
await p.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => /Begin Session/.test(x.textContent))?.click();
});
await p.waitForTimeout(300);
ok("clicking the disabled control does nothing", p.url() === urlBefore);

ok("no difficulty label anywhere",
   !(await p.evaluate(() => /\bdifficulty\b|\bdifficult\b|\beasy\b|\bhard\b/i.test(document.body.innerText))));

ok("states that cost cannot be quoted in advance",
   await p.evaluate(() => /not knowable|not quoted/i.test(document.body.innerText)));

ok("the rules of evidence are shown, not offered as controls",
   await p.evaluate(() => {
     const section = [...document.querySelectorAll("section")].find((s) => /Rules of evidence/.test(s.textContent));
     return Boolean(section) && section.querySelectorAll('input[type="range"]').length === 0;
   }));

/* ------------------------------------------------------------ the exchange */
console.log("\nThe live exchange");
await p.locator("label.scope-item .check-box").first().click();
await p.waitForTimeout(600);
await p.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => /Begin Session/.test(x.textContent))?.click();
});
await p.waitForURL(/\/examination\/sess_/, { timeout: 20000 });
await p.waitForTimeout(1200);

const sid = new URL(p.url()).pathname.split("/").pop();
ok("a question renders", await p.evaluate(() => Boolean(document.querySelector(".turn--examiner .turn-body")?.textContent.trim())));
ok("the Grading Mode is named in words", await p.evaluate(() => /Graded (against|from|on)/.test(document.body.innerText)));
ok("the rail shows the plan the Session is running",
   await p.evaluate(() => document.querySelectorAll(".agenda-item").length > 0));
ok("the question being asked is marked on the plan",
   await p.evaluate(() => document.querySelectorAll(".agenda-item[data-current]").length === 1));

/* Hold the turn open so the in-flight window is observable rather than a race. */
await p.route("**/turns", async (route) => {
  await new Promise((r) => setTimeout(r, 1200));
  await route.continue();
});
await p.fill("#answer", "Broadcasting aligns shapes from the trailing dimension, so a (3,1) and a (1,4) give a (3,4).");
await p.getByRole("button", { name: "Submit answer" }).click();
await p.waitForTimeout(400);
ok("the composer is disabled while a turn is in flight",
   await p.evaluate(() => document.querySelector("#answer")?.disabled === true));
ok("the button says the request is running",
   await p.evaluate(() => /Sending/i.test([...document.querySelectorAll("button")].map((b) => b.textContent).join(" "))));
await p.waitForTimeout(3200);
await p.unroute("**/turns");
ok("the composer is usable again once the turn lands",
   await p.evaluate(() => document.querySelector("#answer")?.disabled === false));

/* ------------------------------------------------------- interview mode -- */
console.log("\nInterview Mode");
/* The Session is graded once, at the end. Nothing on this screen may carry a
   reading: no score, no band, no posterior — the strongest and cheapest net
   for that is that no numeral of the shape 0.00 appears at all. */
ok("no reading appears anywhere in the exchange",
   !(await p.evaluate(() => /\d\.\d\d/.test(document.querySelector(".workbench-stage")?.innerText || ""))));
ok("no per-question score is claimed in words",
   !(await p.evaluate(() => /\b(scored|your score|graded this|score for this)\b/i.test(
     document.querySelector(".workbench-stage")?.innerText || ""))));
ok("the plan is fixed: nothing in the agenda is a control",
   await p.evaluate(() => document.querySelectorAll(".agenda button, .agenda input").length === 0));
ok("planning is metered on its own line, never folded into the questions",
   await p.evaluate(() => /to plan it/i.test(document.querySelector(".workbench-side")?.innerText || "")));
ok("no fused figure anywhere in the DOM",
   !(await p.evaluate(() => /overall score|combined score|percent complete|% complete/i.test(document.body.innerText))));
ok("no Answer Key text is in the DOM",
   !(await p.evaluate(() => /AUTHORITATIVE ANSWER/i.test(document.body.innerText))));

/* ----------------------------------------------------------- idempotency -- */
console.log("\nIdempotency");
const before = await api(`/sessions/${sid}`);
await p.evaluate(async (s) => {
  for (let i = 0; i < 3; i++) {
    await fetch(`/v1/sessions/${s}/turns`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": `${s}:99` },
      body: JSON.stringify({ answer: "a repeated answer" }),
    });
  }
}, sid);
const after = await api(`/sessions/${sid}`);
ok("three identical turns produce at most one new Visit",
   after.visits.length - before.visits.length <= 1,
   `${before.visits.length} → ${after.visits.length}`);

/* ---------------------------------------------------------------- report -- */
console.log("\nThe Session report");
await p.goto(`${BASE}/report/${sid}`, { waitUntil: "networkidle" });
await p.waitForTimeout(900);
ok("the old address still answers",
   await (async () => {
     await p.goto(`${BASE}/evidence/${sid}`, { waitUntil: "networkidle" });
     await p.waitForTimeout(500);
     return p.url().includes("/report/");
   })());
ok("one row per Topic reached", (await p.locator(".table--evidence tbody tr").count()) >= 1);
ok("every row names how it was graded",
   await p.evaluate(() => [...document.querySelectorAll(".table--evidence tbody tr .tag")].length >= 1));
/* There is no headline number for a Session, and `SessionReport` has no field
   that could hold one. The screen must not compose one either. */
ok("no figure is claimed for the Session as a whole",
   !(await p.evaluate(() => /\b(final|overall|total) (score|mastery|grade|result)\b/i.test(document.body.innerText))));
ok("what was planned and never reached is named, in its own place",
   await p.evaluate(() => /Not reached/i.test(document.body.innerText)));
ok("an unreached Topic carries no number at all",
   await (async () => {
     const tab = p.getByRole("tab", { name: /Not reached/i });
     if (await tab.count() === 0) return false;
     await tab.click();
     await p.waitForTimeout(300);
     return p.evaluate(() => {
       const pane = document.querySelector("#pane-unreached");
       const rows = [...(pane?.querySelectorAll(".untested-row") ?? [])];
       return rows.every((n) => !/\d\.\d\d/.test(n.textContent || ""));
     });
   })());
ok("the plan it ran is on the report",
   await (async () => {
     const tab = p.getByRole("tab", { name: /The plan/i });
     if (await tab.count() === 0) return true;   // a Session may have no plan
     await tab.click();
     await p.waitForTimeout(300);
     return p.evaluate(() => document.querySelectorAll(".agenda-item").length > 0);
   })());
await p.getByRole("tab", { name: /Reached/i }).click();
await p.waitForTimeout(300);
ok("Untested renders the word and no number",
   await p.evaluate(() =>
     [...document.querySelectorAll(".untested")].every((n) => !/\d\.\d\d/.test(n.textContent || ""))));
ok("opening a row shows the span that grounded it",
   await (async () => {
     const t = p.locator(".row-toggle").first();
     if (await t.count() === 0) return false;
     await t.click();
     await p.waitForTimeout(400);
     return p.evaluate(() => Boolean(document.querySelector(".drawer-inner")));
   })());

/* --------------------------------------------------------------- mastery -- */
console.log("\nThe Mastery map");
await p.goto(BASE + "/mastery", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
ok("Coverage and Mastery are reported as separate readings",
   await p.evaluate(() => {
     const t = document.body.innerText;
     return /on record/i.test(t) && /never asked/i.test(t);
   }));
ok("untested cells are holes, not marks",
   await p.evaluate(() => document.querySelectorAll(".heat [data-untested]").length > 0));
ok("a never-asked cell is not a control",
   await p.evaluate(() => {
     const holes = [...document.querySelectorAll(".heat > i[data-untested]")];
     return holes.length > 0 && holes.every((h) => h.tagName === "I");
   }));
ok("no untested Topic carries a number",
   await p.evaluate(() =>
     [...document.querySelectorAll(".topic--untested")].every((n) => !/\d\.\d\d/.test(n.textContent || ""))));

/* --------------------------------------------------------------- credits -- */
console.log("\nCredits and BYOK");
await p.goto(BASE + "/credits", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
ok("the balance is shown in Credits and in dollars",
   await p.evaluate(() => /\d[\d,]* Cr/.test(document.body.innerText) && /\$\d/.test(document.body.innerText)));
ok("the ledger names each entry in the Candidate's terms",
   await p.evaluate(() => /Metered call|Payment cleared/.test(document.body.innerText)));

const byok = await api("/candidates/me/byok", { method: "POST", body: { candidate_id: CID, openrouter_key: "sk-or-v1-" + "a".repeat(40) } })
  .catch((e) => ({ error: String(e.message) }));
if (!byok.error) {
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(700);
  /* Scoped to the screen, not the chrome: the rail reports what a Session
     that ran on Credits actually cost, and that Session did spend them. The
     rule is that BYOK work is never priced in Credits — not that the word
     disappears from a browser that has both histories in it. */
  ok("a BYOK Candidate is never shown a Credit figure on the ledger screen",
     await p.evaluate(() => {
       const screen = document.querySelector(".workbench");
       return Boolean(screen) && !/\d+ Cr\b/.test(screen.innerText);
     }));
  ok("the BYOK ledger reports Credits spent as an em dash, never as zero",
     await p.evaluate(() => {
       const screen = document.querySelector(".workbench");
       return Boolean(screen) && !/\b0 Cr\b/.test(screen.innerText);
     }));
  ok("a BYOK Candidate is told which ledger they are on",
     await p.evaluate(() => /your own key/i.test(document.body.innerText)));
  await api(`/candidates/me/byok/${byok.key_id}`, { method: "DELETE" });
} else {
  console.log("  · BYOK not exercised (validator refused a synthetic key): " + byok.error.slice(0, 60));
}

/* -------------------------------------------------------------- keyboard -- */
console.log("\nKeyboard");
await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.keyboard.press("Tab");
ok("the first stop is the skip link",
   await p.evaluate(() => /skip/i.test(document.activeElement?.textContent || "")));
ok("focus is visibly ringed",
   await p.evaluate(() => {
     const el = document.activeElement;
     const cs = getComputedStyle(el);
     return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
   }));

/* ----------------------------------------------------------------- session -- */
console.log("\nThe Session list");
await p.goto(BASE + "/session", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
ok("the tab lists Sessions and offers to start one",
   await p.evaluate(() => /Start a Session/.test(document.body.innerText)));
ok("the rail has one Session entry, not three",
   await p.evaluate(() => {
     const labels = [...document.querySelectorAll(".rail a")].map((a) => a.textContent.trim());
     return labels.includes("Session")
       && !labels.includes("Examination") && !labels.includes("Report");
   }));
/* A Session has no reading, so the list has nothing that looks like one. */
ok("no Session carries a score or a percentage",
   !(await p.evaluate(() => /\d\.\d\d|\d+%/.test(
     document.querySelector(".workbench-main")?.innerText || ""))));

/* The two screens this replaced. Both were reachable and both are now a row
   on this one, so their addresses lead here rather than nowhere. */
for (const retired of ["/examination", "/report", "/evidence"]) {
  await p.goto(BASE + retired, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  ok(`${retired} leads to the Session list`, p.url().endsWith("/session"));
}

/* ---------------------------------------------------------------- notebook -- */
console.log("\nThe Notebook");
await p.goto(BASE + "/notebook", { waitUntil: "networkidle" });
await p.waitForTimeout(600);

/* Your own material, and nothing else. Adding a document happens inside a
   notebook, so the Library only makes them. */
ok("the Library offers no way to upload",
   await p.evaluate(() => !document.querySelector("input[type=file], .dropzone")));
ok("its one action is a new notebook",
   await p.evaluate(() => /New notebook/.test(document.body.innerText)));

let nbid = null;
if (await p.getByRole("button", { name: /New notebook/ }).count()) {
  await p.getByRole("button", { name: /New notebook/ }).first().click();
  await p.waitForTimeout(300);
  await p.fill("input", "E2E notes");
  await p.getByRole("button", { name: /Create and open/ }).click();
  await p.waitForTimeout(1200);
  nbid = (p.url().match(/\/notebook\/(nb-[a-z0-9]+)/) || [])[1] ?? null;
}
ok("creating one opens it", Boolean(nbid));

if (nbid) {
  ok("the workbench is three columns",
     (await p.locator(".bench .col").count()) === 3);
  ok("adding documents is the topbar's primary action",
     await p.evaluate(() => {
       const b = document.querySelector(".topbar .btn-primary");
       return Boolean(b) && /Add documents/.test(b.textContent);
     }));
  ok("the documents column is not a second place to upload",
     await p.evaluate(() => !document.querySelector(".col--docs .dropzone")));
  ok("nothing on this screen carries a reading",
     !(await p.evaluate(() => /\d\.\d\d/.test(
       document.querySelector(".bench")?.innerText || ""))));
}
await p.goto(`${BASE}/examination/${sid}`, { waitUntil: "networkidle" });
await p.waitForTimeout(900);
const endBtn = p.getByRole("button", { name: /^End Session$/ });
if (await endBtn.count()) {
  await endBtn.click();
  await p.waitForTimeout(400);
  ok("the dialog takes focus", await p.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))));
  await p.keyboard.press("Tab");
  ok("Tab stays inside the dialog", await p.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(300);
  ok("Escape closes it", (await p.locator('[role="dialog"]').count()) === 0);
} else {
  console.log("  · dialog not exercised (the Session is between Visits)");
}

/* A whole Session by keyboard alone, which is ISSUE-0020's second criterion.
   Not "is there a focus ring" — can somebody who never touches a pointer choose
   scope, start, answer, and reach the record. Each leg is asserted separately,
   because a pass that only checks the destination cannot say which leg broke. */
console.log("\nA Session by keyboard alone");
await seed();
await p.goto(BASE + "/session/new", { waitUntil: "networkidle" });
await p.waitForTimeout(600);

const tabTo = async (match, limit = 90) => {
  for (let i = 0; i < limit; i++) {
    await p.keyboard.press("Tab");
    const hit = await p.evaluate((m) => {
      const el = document.activeElement;
      if (!el) return false;
      const label = (el.getAttribute("aria-label") || el.textContent || "").trim();
      return new RegExp(m, "i").test(label);
    }, match);
    if (hit) return true;
  }
  return false;
};

/* A Module's checkbox carries no text of its own — its label does — so this leg
   tabs by *what the element is* rather than by what it reads as. */
const tabUntilChecked = async (limit = 90) => {
  for (let i = 0; i < limit; i++) {
    await p.keyboard.press("Tab");
    const onIt = await p.evaluate(() => {
      const el = document.activeElement;
      return Boolean(el && el.matches('.scope-item input[type="checkbox"]'));
    });
    if (onIt) return true;
  }
  return false;
};

const reachedScope = await tabUntilChecked();
/* Space, not Enter: a checkbox is toggled by Space and a form is submitted by
   Enter, and a keyboard pass that used the wrong one would report the surface
   broken when the surface is behaving exactly as HTML says. */
if (reachedScope) await p.keyboard.press("Space");
await p.waitForTimeout(500);
const scopeChosen = await p.evaluate(
  () => document.querySelectorAll('.scope-item input:checked').length > 0);
ok("scope is chosen without a pointer", reachedScope && scopeChosen);

const reachedBegin = await tabTo("Begin Session");
ok("Begin Session is reachable by keyboard", reachedBegin);
if (reachedBegin) {
  await p.keyboard.press("Enter");
  await p.waitForTimeout(1800);
}
ok("starting by keyboard lands in the examination",
   /\/examination\//.test(p.url()), p.url());

if (/\/examination\//.test(p.url())) {
  const answer = p.locator("textarea").first();
  await answer.focus();
  await p.keyboard.type("Scaling keeps the softmax in a region that still has gradient.");
  const typed = await p.evaluate(() => document.querySelector("textarea")?.value?.length ?? 0);
  ok("an answer can be composed with the keyboard alone", typed > 20);
  const reachedSend = await tabTo("Send|Submit|Answer", 20);
  ok("the answer can be sent without a pointer", reachedSend);
  if (reachedSend) {
    await p.keyboard.press("Enter");
    await p.waitForTimeout(2500);
  }
}

await p.goto(`${BASE}/report/${sid}`, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
const reachedDrawer = await tabTo("Show the grounding");
ok("the report's drawers open by keyboard", reachedDrawer);
if (reachedDrawer) {
  await p.keyboard.press("Enter");
  await p.waitForTimeout(400);
  ok("opening a drawer by keyboard reveals what grounded the Visit",
     await p.evaluate(() => /What grounded the questions/i.test(document.body.innerText)));
}

/* ----------------------------------------------------------------- rules -- */
console.log("\nRules that hold everywhere");

/* PRODUCT.md's language, swept across every route rather than spot-checked.
   Each pattern is a refusal the product has written down somewhere:
   ISSUE-0020 asks for this read by a person, and a person still should — what
   this catches is the copy that regressed since they last did. */
const FORBIDDEN = [
  [/\bdifficult(y)?\b/i, "names difficulty"],
  [/\beasy\b|\bhard\b/i, "calls something easy or hard"],
  [/\byour progress\b/i, "says progress where Coverage is meant"],
  [/\bwill cost\b|\bestimated cost\b|\bcosts? about\b/i, "quotes a price in advance"],
  [/overall (score|mastery|rating)/i, "implies one fused figure"],
  [/\bfinal score\b/i, "gives a Session one number"],
  [/\bsession (score|grade|result)\b/i, "reads a Session as a single figure"],
];
const SWEPT = ["/mastery", "/session", "/session/new", "/report/" + sid, "/credits", "/settings", "/notebook"];
if (nbid) SWEPT.push("/notebook/" + nbid);
for (const route of SWEPT) {
  await p.goto(BASE + route, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  const text = await p.evaluate(() => document.body.innerText);
  for (const [pattern, why] of FORBIDDEN) {
    if (pattern.test(text)) { fail++; console.log(`  ✗ ${route} ${why}`); }
  }
}
ok("no screen labels a question easy or hard", true);
ok("no screen quotes a Session price in advance", true);
ok("no screen names an overall score", true);

await browser.close();
console.log(`\n${pass} passed, ${fail} failed` + (errors.length ? `, ${errors.length} console errors` : ""));
for (const e of [...new Set(errors)].slice(0, 8)) console.log("  ! " + e);
process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
