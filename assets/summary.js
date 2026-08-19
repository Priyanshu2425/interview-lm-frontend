/* ISSUE-0017 — the Session summary and the Candidate's record.

   The screen that refuses the single number hardest. Coverage and Mastery are
   two readings and nothing here merges them; the largest section is the one a
   conventional summary cannot express — the Topics never asked about. */

import { api, who } from "./api.js";
import { BandToken, h, ReadingPair, Spinner } from "./components.js";
import { PosteriorRidge } from "./ridge.js";
import { TopBar, candidateBadge, fail, mount } from "./shell.js";

const sessionId = new URLSearchParams(location.search).get("id");

/* Plural agreement matters here: these sentences are read by someone deciding
   what to study next, and "1 were marked" reads as a bug in the record. */
function gradedByLine(s) {
  const gt = s.ground_truth_visits;
  const other = s.text_grounded_visits + s.model_judgment_visits;
  const was = (n) => (n === 1 ? "was" : "were");
  if (gt && other)
    return `${gt} ${was(gt)} marked against an Answer Key; `
      + `${other} ${was(other)} marked against the course text or the `
      + "interviewer's own knowledge.";
  if (gt) return `All ${gt} ${was(gt)} marked against an Answer Key, `
    + "which is the strongest evidence this Corpus offers.";
  return `${other} ${was(other)} marked against the course text or the `
    + "interviewer's own knowledge — real evidence, at reduced weight.";
}

/* Mastery reads as two counts, but "0 solid, 0 weak" is misleading when every
   examined Topic is simply still an early signal. Say that instead. */
function masteryLine(m) {
  if (!m.reportable_topics) return "Nothing to report yet";
  if (!m.looks_solid && !m.looks_weak) return "Too early to call, on all of them";
  const parts = [];
  if (m.looks_solid) parts.push(`${m.looks_solid} look solid`);
  if (m.looks_weak) parts.push(`${m.looks_weak} look weak`);
  return parts.join(" · ");
}

function masteryNote(m) {
  if (!m.reportable_topics) return "no Topic has enough evidence yet";
  if (!m.looks_solid && !m.looks_weak)
    return `${m.reportable_topics} examined once each — a signal, not a verdict`;
  return `of the ${m.reportable_topics} with enough evidence to say`;
}

function TopicRow(t) {
  const reportable = t.band !== "untested" && t.mastery !== null;
  return h("tr", {},
    h("td", {},
      h("div", { style: "font-weight:600" }, t.title || t.topic_id),
      h("div", { class: "t-sm muted" }, t.module_title || "")),
    h("td", {},
      BandToken(t.band, t.label),
      h("div", { class: "t-sm muted", style: "margin-top:3px" },
        reportable ? `centre ≈ ${t.mastery.toFixed(2)}` : "too little to call")),
    h("td", {},
      PosteriorRidge({ alpha: t.alpha, beta: t.beta, band: t.band,
                       label: t.label, height: 42 })),
    h("td", { class: "tbl__num" }, t.coverage.toFixed(1)),
    h("td", {}, h("span", { class: "tag" },
      t.graded_by === "ground_truth" ? "Answer Key"
        : t.graded_by === "text_grounded" ? "Topic text" : "Model judgment")));
}

function render(s, readings) {
  const cov = s.coverage, mas = s.mastery;
  const untestedTotal = cov.topics_total - cov.topics_examined;

  mount(
    TopBar({ right: candidateBadge() }),
    h("div", { class: "main" }, h("div", { class: "centre" },
      h("div", { class: "page page--wide" },
        h("div", { class: "t-label" },
          `Session ended · ${Math.round(s.duration_seconds / 60)} minutes${s.provider ? ` · ${s.provider}` : ""}`),
        h("h1", { class: "t-display", style: "margin-top:8px" },
          `You were examined on ${s.topics_examined} Topic${s.topics_examined === 1 ? "" : "s"}`),
        h("p", { class: "muted t-body", style: "margin-top:10px;max-width:64ch" },
          gradedByLine(s)),

        h("section", { class: "section" },
          ReadingPair({
            coverage: `${cov.topics_examined} of ${cov.topics_total}`,
            coverageNote: "Topics you have ever been examined on",
            mastery: masteryLine(mas),
            masteryNote: masteryNote(mas),
          }),
          h("p", { class: "t-sm muted", style: "margin-top:12px;max-width:70ch" },
            "These two are reported separately, always. Coverage tells untouched "
            + "from touched; Mastery tells strong from weak. Merged into a single "
            + "percentage they would answer neither question."),
          h("p", { class: "t-sm muted", style: "margin-top:6px" },
            `Coverage counts effective Topic Visits — ${cov.effective_visits} so far.`)),

        s.per_topic.length
          ? h("section", { class: "section" },
              h("div", { class: "section__hd spread" },
                h("h2", { class: "t-h2" }, "Topic by Topic"),
                h("span", { class: "t-sm muted" }, "Width is confidence, not score")),
              h("div", { class: "panel" },
                h("div", { class: "scroll-note" }, "Scroll for more columns"),
                h("div", { class: "scroll-x" },
                  h("table", { class: "tbl" },
                    h("thead", {}, h("tr", {},
                      h("th", { style: "min-width:220px" }, "Topic"),
                      h("th", { style: "width:150px" }, "Reading"),
                      h("th", { style: "width:180px" }, "Distribution"),
                      h("th", { class: "tbl__num", style: "width:96px" }, "Coverage"),
                      h("th", { style: "width:130px" }, "Graded by"))),
                    h("tbody", {}, ...s.per_topic.map(TopicRow))))))
          : null,

        h("section", { class: "section" },
          h("div", { class: "section__hd" },
            h("h2", { class: "t-h2" },
              `${untestedTotal} Topics you have never been asked about`),
            h("p", { class: "t-sm muted", style: "margin-top:4px;max-width:66ch" },
              "This is not a failing grade. It is the part of the course you have "
              + "no evidence on either way, and it is the reason the next Session "
              + "won't simply re-ask what you just answered.")),
          h("div", { class: "panel" }, h("div", { class: "panel__bd" },
            h("div", { class: "stack", style: "--gap:14px" },
              ...s.untested_modules.flatMap((m, i) => [
                i ? h("hr", { class: "hr" }) : null,
                h("div", { class: "spread", style: "align-items:flex-start;gap:16px" },
                  h("div", { style: "min-width:0" },
                    h("div", { style: "font-weight:600;font-size:.875rem" }, m.title),
                    h("div", { class: "t-sm muted", style: "margin-top:2px" },
                      `${m.topics_untested} of ${m.topics_total} Topics untested`
                      + (m.has_ground_truth ? "" : " · no Answer Keys here, so questions would be marked against the Module's own material"))),
                  BandToken("untested", "Untested")),
              ].filter(Boolean)))),
            h("div", { class: "panel__ft" },
              h("p", { class: "t-sm muted", style: "margin:0" },
                "An untested Topic reads as unknown, never as zero. That "
                + "distinction is the whole reason your record is kept as a "
                + "distribution instead of a score.")))),

        readings?.topics?.length
          ? h("section", { class: "section" },
              h("div", { class: "section__hd" },
                h("h2", { class: "t-h2" }, "Where you look weakest"),
                h("p", { class: "t-sm muted", style: "margin-top:4px" },
                  "Only Topics with enough evidence to say. Untested Topics are "
                  + "absent rather than ranked last — they are unknown, not weak.")),
              h("div", { class: "panel" }, h("div", { class: "panel__bd stack", style: "--gap:12px" },
                ...readings.topics.slice(0, 6).map((t) =>
                  h("div", { class: "spread", style: "gap:14px;align-items:flex-start" },
                    h("div", { style: "min-width:0" },
                      h("div", { style: "font-weight:600;font-size:.875rem" }, t.title),
                      h("div", { class: "t-sm muted" },
                        `centre ≈ ${t.mastery.toFixed(2)} · ${t.coverage.toFixed(1)} effective visits`)),
                    BandToken(t.band, t.label))))))
          : null,

        s.spend?.credits !== null && s.spend?.credits !== undefined
          ? h("section", { class: "section" },
              h("div", { class: "panel panel--flat" }, h("div", { class: "panel__bd" },
                h("div", { class: "t-label" }, "What this Session cost"),
                h("div", { class: "row row--wrap", style: "gap:24px;margin-top:12px" },
                  ...[[s.spend.credits, "Credits spent"],
                      [s.spend.per_topic, "Avg per Topic"],
                      [s.spend.balance, "Balance"]]
                    .map(([v, l]) => h("div", {},
                      h("div", { class: "num t-h2" }, String(v)),
                      h("div", { class: "t-sm muted" }, l)))),
                h("p", { class: "t-sm muted", style: "margin-top:14px;max-width:64ch" },
                  "One Credit is one US cent of what the provider charged us, "
                  + "with no markup and no house rate."))))
          : null),

      h("div", { class: "actionbar" },
        h("a", { class: "btn btn--quiet", href: "/credits.html" }, "Credits"),
        h("a", { class: "btn", style: "flex:1", href: "/" }, "Start another Session")))));
}

(async function boot() {
  try {
    mount(TopBar({}), h("div", { class: "center" }, Spinner("Building your summary")));
    const [s, readings] = await Promise.all([
      api.summary(sessionId),
      api.weakest(who.id).catch(() => ({ topics: [] })),
    ]);
    render(s, readings);
  } catch (e) { mount(TopBar({}), fail(e)); }
})();
