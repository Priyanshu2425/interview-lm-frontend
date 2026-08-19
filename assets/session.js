/* ISSUE-0015 + ISSUE-0016 — the live exchange, and the Topic it closes.

   The turn loop is the whole of this file and it follows ADR-0011 exactly: the
   Answer Turn is a request carrying an idempotency key, generated once per
   composed answer and reused on every retry. A mashed button, a dropped
   connection and a refresh all converge on one Answer Turn, because the thing
   on the other side is a permanent write. */

import { api, who } from "./api.js";
import { CostChip, GradingModeChip, ProvenanceChip, h, Notice, Spinner }
  from "./components.js";
import { PosteriorRidge, RidgeCaption } from "./ridge.js";
import { TopBar, fail, mount } from "./shell.js";

const sessionId = new URLSearchParams(location.search).get("id");

const S = {
  question: "",
  kind: "question",
  topicTitle: "",
  topicId: "",
  visitId: "",
  mode: "ground_truth",
  thread: [],            // {role, kind, text}
  turnIndex: 0,          // drives the idempotency key
  inFlight: false,
  lastVisit: null,
  visits: [],
  parked: null,
  ended: null,
  sheet: false,
  spend: null,
};

/* -- the turn loop -------------------------------------------------------- */

function absorb(out) {
  const p = out.payload || out;
  if (p.last_visit) S.lastVisit = p.last_visit;

  if (out.kind === "session_ended") {
    S.ended = { reason: p.reason, balance: p.balance };
    return;
  }
  if (out.kind === "session_parked") {
    S.parked = p;
    return;
  }
  if (out.kind === "visit_closed") return;

  // a question, probe or hint
  const opening = out.kind === "question";
  if (opening) {
    S.thread = [];
    S.topicTitle = p.topic_title || S.topicTitle;
    S.topicId = p.topic_id || S.topicId;
    S.visitId = p.topic_visit_id || S.visitId;
    S.mode = p.grading_mode || S.mode;
  }
  S.kind = out.kind;
  S.question = p.question;
  S.thread.push({ role: "interviewer", kind: out.kind, text: p.question });
}

async function submit(answer) {
  if (S.inFlight || !answer.trim()) return;
  S.inFlight = true;
  S.thread.push({ role: "candidate", kind: "answer", text: answer });
  render();

  const idx = S.turnIndex;          // fixed for this composed answer
  try {
    const out = await api.submitTurn(sessionId, answer, idx);
    S.turnIndex += 1;
    S.inFlight = false;
    absorb(out);
    refreshSide();
    render();
  } catch (e) {
    S.inFlight = false;
    /* A timeout is a park, not an error. Recovery reads the Session and
       resumes — the same path an interruption already uses, so there is one
       code path for "we lost the thread" rather than two. */
    try {
      const live = await api.session(sessionId);
      if (live.pending) {
        S.question = live.pending.question;
        S.kind = live.pending.kind || "question";
        S.visitId = live.pending.topic_visit_id;
        render();
        return;
      }
      S.parked = { code: "CONNECTION_LOST", message: e.message };
    } catch {
      S.parked = { code: "CONNECTION_LOST", message: e.message };
    }
    render();
  }
}

async function refreshSide() {
  try {
    const [live, spend] = await Promise.all([
      api.session(sessionId), api.spend(sessionId).catch(() => null),
    ]);
    S.visits = live.visits || [];
    S.spend = spend;
  } catch { /* the side rails are decoration; the loop does not depend on them */ }
}

/* -- rendering ------------------------------------------------------------ */

const KIND_LABEL = { probe: "Probing", hint: "Hint", question: "Question" };
const KIND_CLASS = { probe: "turn__kind--probe", hint: "turn__kind--hint",
                     question: "turn__kind--followup" };

function Thread() {
  const parts = [];
  S.thread.forEach((t, i) => {
    if (t.role === "candidate") {
      parts.push(h("div", { class: "turn" },
        h("div", { class: "a" },
          h("div", { class: "a__who" }, "Your answer"),
          h("p", { style: "margin:0" }, t.text))));
      return;
    }
    if (i === 0) {
      parts.push(h("div", { class: "q__meta t-label" }, "Question"));
      parts.push(h("p", { class: "q t-question" }, t.text));
      return;
    }
    parts.push(h("div", { class: "turn" },
      h("div", { class: `turn__kind ${KIND_CLASS[t.kind] || ""}` },
        KIND_LABEL[t.kind] || t.kind),
      h("p", { class: "turn__body", style: "margin:0" }, t.text),
      t.kind === "hint"
        ? h("p", { class: "t-sm", style: "color:#8fa6c9;margin:10px 0 0" },
            "Taking a hint doesn't void the question. It's a real answer worth "
            + "roughly half, and that lands in the score, not in how much this "
            + "Topic counts for.")
        : null));
  });
  const turns = S.thread.filter((t) => t.role === "candidate").length;
  if (turns > 1) {
    parts.push(h("div", { class: "resolve" },
      h("div", { class: "resolve__note" },
        h("span", {}, h("strong", { style: "color:#c9dcf5" }, `${turns} turns so far.`),
          " They resolve into one score for this Topic — probing a concept three "
          + "times is one observation examined closely, not three results."))));
  }
  return parts;
}

function VisitResult(v) {
  /* ISSUE-0016. The band and the mastery arrive decided; nothing here derives
     them, and there is no branch that prints a number for an untested Topic. */
  const reportable = v.band !== "untested" && v.mastery !== null
    && v.mastery !== undefined;
  return h("div", { class: "panel", style: "margin-top:22px" },
    h("div", { class: "panel__bd" },
      h("div", { class: "spread", style: "align-items:flex-start;gap:18px" },
        h("div", {},
          h("div", { class: "t-label" }, "Score for this Topic"),
          h("div", { class: "num", style: "font-size:2.25rem;font-weight:500;letter-spacing:-.03em;line-height:1.1" },
            v.score.toFixed(2)),
          h("div", { class: "t-sm muted" }, v.topic_title || "")),
        h("div", { style: "text-align:right;flex-shrink:0" },
          GradingModeChip(v.grading_mode),
          h("div", { class: "t-sm muted", style: "margin-top:8px" },
            `weight ${v.weight}`))),
      h("hr", { class: "hr", style: "margin:16px 0" }),
      h("div", { class: "t-label" }, "Why"),
      h("p", { class: "t-body", style: "margin-top:6px;max-width:64ch" },
        v.rationale || "—"),
      h("div", { class: "row row--wrap", style: "margin-top:14px;gap:8px" },
        ProvenanceChip({ grader: v.grader, provider: v.provider,
                         rubric_version: v.rubric_version }),
        CostChip(S.spend?.per_visit?.find((x) => x.topic_visit_id === v.topic_visit_id)?.credits,
                 S.spend?.route || "credits")),
      h("p", { class: "t-sm muted", style: "margin-top:10px;max-width:62ch" },
        "The grader never saw the conversation, only the question, your answer, "
        + "and the material behind it. It has no memory of you being articulate."),
      h("hr", { class: "hr", style: "margin:18px 0 14px" }),
      h("div", { class: "t-label" }, "What that did to this Topic"),
      h("div", { style: "margin-top:10px" },
        PosteriorRidge({
          alpha: v.alpha, beta: v.beta, band: v.band, label: v.band_label,
          from: { alpha: 1, beta: 1 },
        }),
        RidgeCaption("weak", `α ${v.alpha.toFixed(2)} · β ${v.beta.toFixed(2)}`, "strong")),
      h("div", { class: "readings", style: "margin-top:16px" },
        h("div", { class: "reading" },
          h("div", { class: "reading__label" }, "Coverage of this Topic"),
          h("div", { class: "reading__value" }, v.coverage.toFixed(1)),
          h("div", { class: "reading__note" }, "effective Topic Visits")),
        h("div", { class: "reading" },
          h("div", { class: "reading__label" }, "Mastery of this Topic"),
          h("div", { class: "reading__value",
                     style: reportable ? "" : "font-family:var(--sans);font-size:1rem;font-weight:600;letter-spacing:0" },
            reportable ? v.mastery.toFixed(2) : "Not yet reportable"),
          h("div", { class: "reading__note" },
            reportable ? "centre of the posterior" : "one answer is an early signal"))),
      h("p", { class: "t-sm muted", style: "margin-top:12px;max-width:62ch" },
        "These are two different facts and are never merged into one figure.")));
}

function Rails() {
  return [
    h("aside", { class: "rail on-ink", "aria-label": "Session" },
      h("div", { style: "padding:18px 16px;border-bottom:1px solid var(--ink-3)" },
        h("div", { class: "t-label" }, "Session"),
        h("div", { style: "color:#fff;font-weight:600;margin-top:6px;font-size:.875rem" },
          S.topicTitle || "—"),
        h("div", { class: "t-sm", style: "color:#8fa6c9;margin-top:4px" },
          `${S.visits.length} Topic${S.visits.length === 1 ? "" : "s"} so far`)),
      h("div", { style: "padding:18px 16px" },
        h("div", { class: "t-label" }, "This Session so far"),
        ...[["Topics examined", String(S.visits.filter((v) => v.state === "graded").length)],
            ["Spent", S.spend?.credits === null || S.spend?.credits === undefined
              ? "—" : `${S.spend.credits} Cr`]]
          .map(([k, v]) => h("div", { class: "row", style: "margin-top:8px;justify-content:space-between" },
            h("span", { class: "t-sm", style: "color:#8fa6c9" }, k),
            h("span", { class: "t-sm", style: "color:#fff" }, v))))),

    h("aside", { class: "rail rail--right on-ink", "aria-label": "Topics" },
      h("div", { style: "padding:16px 16px 8px", class: "spread" },
        h("h2", { class: "t-label", style: "margin:0" }, "Topics this Session")),
      h("div", { class: "visits" },
        ...S.visits.map((v, i) => {
          const done = v.state === "graded";
          const open = v.state === "open" || v.state === "answered";
          return h("button", {
            class: `visit ${done ? "visit--done" : open ? "visit--open" : "visit--todo"}`,
            "aria-current": String(v.topic_visit_id === S.visitId),
          },
            h("span", { class: "visit__n" }, done ? "✓" : String(i + 1)),
            h("span", { class: "visit__body" },
              h("span", { class: "visit__topic" }, v.topic_id.slice(0, 22) + "…"),
              h("span", { class: "visit__meta" },
                open ? "Open · not yet scored" : v.grading_mode || v.state)));
        }))),
  ];
}

function Sheet() {
  if (!S.sheet) return null;
  return h("div", { class: "overlay", "data-open": "true",
                    onmousedown: (e) => { if (e.target.classList.contains("overlay")) { S.sheet = false; render(); } } },
    h("div", { class: "sheet", role: "dialog", "aria-modal": "true",
               "aria-label": "This Session" },
      h("div", { class: "sheet__hd" },
        h("h2", { class: "t-h3" }, "This Session"),
        h("button", { class: "iconbtn", "aria-label": "Close",
                      onclick: () => { S.sheet = false; render(); },
                      html: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` })),
      h("div", { class: "sheet__bd" },
        h("div", { class: "readings" },
          h("div", { class: "reading" },
            h("div", { class: "reading__label" }, "Topics examined"),
            h("div", { class: "reading__value" },
              String(S.visits.filter((v) => v.state === "graded").length))),
          h("div", { class: "reading" },
            h("div", { class: "reading__label" }, "Spent so far"),
            h("div", { class: "reading__value" },
              S.spend?.credits === null || S.spend?.credits === undefined
                ? "—" : `${S.spend.credits} Cr`),
            h("div", { class: "reading__note" },
              S.spend?.route === "byok"
                ? "you are on your own key" : "one Credit is one US cent"))),
        h("div", { style: "margin-top:20px" },
          h("div", { class: "t-label" }, "Grading this Topic"),
          h("div", { style: "margin-top:8px" }, GradingModeChip(S.mode)))),
      h("div", { class: "sheet__ft" },
        h("button", { class: "btn btn--quiet",
                      onclick: () => { S.sheet = false; render(); } }, "Keep going"),
        h("button", { class: "btn btn--quiet", style: "margin-left:auto",
                      onclick: endSession }, "End after this Topic"))));
}

async function endSession() {
  try {
    const out = await api.endSession(sessionId);
    if (out.state === "ended") location.href = `/summary.html?id=${sessionId}`;
    else { S.sheet = false; S.endNote = out.note; render(); }
  } catch (e) { S.parked = { code: "ERROR", message: e.message }; render(); }
}

function render() {
  if (S.ended) {
    mount(TopBar({ title: "Session ended" }),
      h("div", { class: "main" }, h("div", { class: "centre" },
        h("div", { class: "page" },
          S.lastVisit ? VisitResult(S.lastVisit) : null,
          Notice("info", "Session ended",
            S.ended.reason === "scope_exhausted"
              ? "You were examined on every Topic in the scope you chose."
              : `Ended: ${S.ended.reason.replace(/_/g, " ")}.`),
          h("div", { class: "row", style: "margin-top:18px;gap:10px" },
            h("a", { class: "btn", href: `/summary.html?id=${sessionId}` },
              "See the summary"))))));
    return;
  }

  if (S.parked) {
    const credits = String(S.parked.code || "").startsWith("CREDITS");
    mount(TopBar({ title: "Session parked" }),
      h("div", { class: "main" }, h("div", { class: "centre" },
        h("div", { class: "page" },
          S.lastVisit ? VisitResult(S.lastVisit) : null,
          Notice(credits ? "warn" : "danger",
            credits ? "Your Credits ran out" : (S.parked.provider
              ? `${S.parked.provider} could not be reached` : "The Session is parked"),
            S.parked.message,
            [credits
              ? h("a", { class: "btn btn--sm", href: "/credits.html" }, "Add Credits")
              : null,
             h("button", { class: "btn btn--sm btn--quiet", onclick: resume },
               "Resume")].filter(Boolean))))));
    return;
  }

  mount(
    TopBar({ ink: true, title: S.topicTitle || "Interview",
             sub: S.mode ? undefined : undefined, back: "/",
             right: h("button", { class: "iconbtn", "aria-label": "Session detail",
               onclick: () => { S.sheet = true; render(); },
               html: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.5"/><path d="M8 7.2v4M8 4.8v.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>` }) }),
    h("div", { class: "main" },
      ...Rails().slice(0, 1),
      h("div", { class: "centre" },
        h("div", { class: "exchange on-ink" },
          h("div", { class: "exchange__scroll" },
            h("div", { class: "exchange__inner" },
              h("div", { class: "visit-hd" },
                h("div", { class: "row row--wrap", style: "gap:8px;margin-bottom:9px" },
                  GradingModeChip(S.mode)),
                h("div", { class: "visit-hd__topic" }, S.topicTitle || "—")),
              ...Thread(),
              S.inFlight
                ? h("div", { class: "thinking" },
                    h("div", { class: "spin", "aria-hidden": "true" }),
                    h("span", {}, "Reading your answer…"))
                : null,
              S.lastVisit && !S.inFlight ? VisitResult(S.lastVisit) : null)),
          h("div", { class: "composer" },
            h("form", { class: "composer__inner", onsubmit: (e) => {
                e.preventDefault();
                const f = e.target.querySelector("textarea");
                const v = f.value; f.value = ""; submit(v);
              } },
              h("label", { class: "sr", for: "answer" }, "Your answer"),
              h("textarea", { class: "composer__field", id: "answer",
                disabled: S.inFlight,
                placeholder: "Answer in your own words — you can think out loud.",
                onkeydown: (e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                    e.target.form.requestSubmit();
                } }),
              h("div", { class: "composer__bar" },
                h("span", { class: "composer__hint" },
                  S.inFlight ? "Waiting for the interviewer…" : "⌘↵ to submit"),
                h("button", { class: "btn btn--onink", type: "submit",
                              style: "margin-left:auto", disabled: S.inFlight },
                  S.inFlight ? "Sending…" : "Submit answer")))))),
      ...Rails().slice(1)),
    Sheet());
}

async function resume() {
  try {
    const out = await api.resume(sessionId);
    S.parked = null;
    absorb(out);
    await refreshSide();
    render();
  } catch (e) { S.parked = { code: "ERROR", message: e.message }; render(); }
}

(async function boot() {
  if (!sessionId) { location.href = "/"; return; }
  try {
    mount(TopBar({ ink: true }), h("div", { class: "center" }, Spinner("Opening the Session")));
    const seed = sessionStorage.getItem("first_turn");
    if (seed) {
      sessionStorage.removeItem("first_turn");
      absorb({ kind: "question", payload: JSON.parse(seed) });
    } else {
      /* A refresh mid-Session: read the Session and pick up where it parked. */
      const live = await api.session(sessionId);
      if (live.pending) absorb({ kind: live.pending.kind || "question",
                                 payload: live.pending });
      else if (live.state === "ended") { location.href = `/summary.html?id=${sessionId}`; return; }
      else S.parked = { code: "PARKED", message: live.parked_reason || "This Session is parked." };
    }
    await refreshSide();
    render();
  } catch (e) { mount(TopBar({}), fail(e)); }
})();
