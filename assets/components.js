/* Domain components.
   These carry product rules, which is why the inventory is not just a UI kit.
   The pattern throughout: a rule is expressed as an ABSENT API, not as a review
   comment. ReadingPair has no combined output, so a fused percentage cannot be
   added by accident. */

const BAND_CLASS = {
  untested: "band--untested",
  early: "band--hedged",
  firm_weak: "band--firm-weak",
  firm_strong: "band--firm-strong",
};

const MODE_LABEL = {
  ground_truth: "Graded against an Answer Key",
  text_grounded: "Graded from the course text",
  model_judgment: "Graded on the interviewer's own knowledge",
};

const MODE_CLASS = {
  ground_truth: "chip--gt",
  text_grounded: "chip--text",
  model_judgment: "chip--model",
};

export function h(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

/* Word first, colour second. Never colour alone — PRODUCT.md names the bands
   as the one place that rule is unconditional. */
export function BandToken(band, label) {
  return h("span", { class: `band ${BAND_CLASS[band] || "band--untested"}` },
    h("span", { class: "band__mark", "aria-hidden": "true" }),
    label || "Untested");
}

export function GradingModeChip(mode) {
  return h("span", { class: `chip ${MODE_CLASS[mode] || "chip--model"}` },
    h("span", { class: "chip__dot", "aria-hidden": "true" }),
    MODE_LABEL[mode] || mode);
}

/* Grader, provider and rubric version. Non-optional: a score with no
   provenance is not a score we are willing to show. */
export function ProvenanceChip({ grader, provider, rubric_version }) {
  if (!grader) throw new Error("provenance requires a grader");
  const who = grader === "judge_subagent" ? "Judge Subagent" : "Judge";
  return h("span", { class: "row row--wrap", style: "gap:6px" },
    h("span", { class: "tag" }, `${who} · blind to the conversation`),
    provider ? h("span", { class: "tag" }, provider) : null,
    rubric_version ? h("span", { class: "tag" }, `rubric ${rubric_version}`) : null);
}

/* Renders an em dash when the route is not Credits. Never 0 — zero reads as
   "it was free" rather than "this ledger does not apply to you". */
export function CostChip(credits, route = "credits") {
  const spend = route === "credits" ? `${credits ?? 0} Cr` : "—";
  return h("span", { class: "tag num", title: route === "credits"
    ? "one Credit is one US cent of provider cost"
    : "you are on your own key, so no Credits are spent" }, spend);
}

/* Takes Coverage and Mastery as two props. Deliberately has NO combined
   output — the rule is the absent API. */
export function ReadingPair({ coverage, mastery, coverageNote, masteryNote }) {
  return h("div", { class: "readings" },
    h("div", { class: "reading" },
      h("div", { class: "reading__label" }, "Coverage"),
      h("div", { class: "reading__value" }, coverage),
      coverageNote ? h("div", { class: "reading__note" }, coverageNote) : null),
    h("div", { class: "reading" },
      h("div", { class: "reading__label" }, "Mastery"),
      h("div", { class: "reading__value" }, mastery),
      masteryNote ? h("div", { class: "reading__note" }, masteryNote) : null));
}

/* A Topic's reading. Below the Evidence Floor it renders the word and NO
   number — there is deliberately no branch here that prints one. */
export function TopicReading(t) {
  const reportable = t.band !== "untested" && t.mastery !== null;
  return h("div", { class: "spread", style: "align-items:flex-start;gap:14px" },
    h("div", { style: "min-width:0" },
      h("div", { style: "font-weight:600;font-size:.875rem" }, t.title || t.topic_id),
      h("div", { class: "t-sm muted", style: "margin-top:2px" },
        reportable
          ? `centre ≈ ${t.mastery.toFixed(2)} · ${t.coverage.toFixed(1)} effective visits`
          : "not enough evidence to put a number on")),
    BandToken(t.band, t.label));
}

export function Notice(kind, title, body, actions = []) {
  return h("div", { class: `notice notice--${kind}` },
    h("div", {},
      h("div", { class: "notice__title" }, title),
      h("div", { class: "notice__body" }, body),
      actions.length
        ? h("div", { class: "row", style: "margin-top:12px;gap:8px" }, ...actions)
        : null));
}

export function Synthetic(text = "Sample data") {
  return h("span", { class: "synthetic" }, text);
}

export function Skeleton(n = 3) {
  return h("div", {}, ...Array.from({ length: n },
    () => h("div", { class: "skeleton skeleton--line" })));
}

export function Spinner(label = "Working") {
  return h("div", { class: "row", style: "gap:10px" },
    h("div", { class: "spin", "aria-hidden": "true" }),
    h("span", { class: "t-sm muted" }, label));
}
