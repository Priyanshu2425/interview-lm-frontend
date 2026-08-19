/* ISSUE-0014 — Session setup.

   The surface computes nothing: Topic counts, Answer Key counts and the mode a
   scope can support all arrive from the API. The prototype hard-coded them;
   here they must come from the Corpus so they stay true. */

import { api, who } from "./api.js";
import { h, Notice, Spinner } from "./components.js";
import { TopBar, candidateBadge, fail, mount } from "./shell.js";

const state = {
  track: "aiml",
  modules: [],
  chosen: new Set(),
  duration: 1800,
  provider: "deepseek",
  prices: [],
  scope: null,
  starting: false,
};

const DURATIONS = [
  [900, "15 min"], [1800, "30 min"], [2700, "45 min"], [3600, "60 min"],
];

async function refreshScope() {
  const ids = [...state.chosen];
  state.scope = ids.length ? await api.scope(ids) : null;
  render();
}

function ModuleRow(m) {
  const on = state.chosen.has(m.module_id);
  const gt = m.ground_truth_topic_count;
  return h("button", {
    class: "opt", "data-on": String(on), "aria-pressed": String(on),
    onclick: () => {
      on ? state.chosen.delete(m.module_id) : state.chosen.add(m.module_id);
      refreshScope();
    },
  },
    h("span", { class: "opt__box",
      html: `<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.4 4 7.4 10 1.4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` }),
    h("span", {},
      h("span", { class: "opt__title" }, `${m.order} · ${m.title}`),
      h("span", { class: "opt__sub" }, m.description
        ? m.description.split("\n")[0].slice(0, 96)
        : "")),
    h("span", { class: "opt__right" },
      h("span", { class: "t-sm" },
        h("span", { class: "num" }, String(m.topic_count)), " Topics"),
      h("br"),
      gt > 0
        ? h("span", { class: "chip chip--gt", style: "margin-top:5px" },
            `${gt} Answer Key${gt > 1 ? "s" : ""}`)
        : h("span", { class: "chip chip--text", style: "margin-top:5px" },
            "Graded from text")));
}

function ProviderRow(p) {
  const on = state.provider === p.provider;
  return h("button", {
    class: "opt", "data-on": String(on), "aria-pressed": String(on),
    onclick: () => { state.provider = p.provider; render(); },
  },
    h("span", { class: "opt__box opt__box--radio",
      html: `<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#fff"/></svg>` }),
    h("span", {},
      h("span", { class: "opt__title" },
        p.provider[0].toUpperCase() + p.provider.slice(1)),
      h("span", { class: "opt__sub" },
        p.observed_visits
          ? `${p.basis}`
          : "no Sessions on this provider yet, so there is nothing to report")),
    h("span", { class: "opt__right" },
      h("span", { class: "chip chip--neutral" },
        p.observed_visits
          ? [h("span", { class: "num" }, String(p.credits_per_visit)), " Cr / Topic"]
          : "no history yet")));
}

async function start() {
  if (!state.chosen.size || state.starting) return;
  state.starting = true; render();
  try {
    const out = await api.startSession({
      candidate_id: who.id,
      module_ids: [...state.chosen],
      duration_seconds: state.duration,
      provider: state.provider,
      payment_route: "credits",
    });
    sessionStorage.setItem("first_turn", JSON.stringify(out));
    location.href = `/session.html?id=${encodeURIComponent(out.session_id)}`;
  } catch (e) {
    state.starting = false;
    render();
    mount(document.getElementById("app").firstChild,
      h("div", { class: "page" },
        Notice("danger", "Could not start the Session", e.message)));
  }
}

function render() {
  const s = state.scope;
  const canStart = state.chosen.size > 0 && !state.starting;

  mount(
    TopBar({ right: candidateBadge() }),
    h("div", { class: "main" }, h("div", { class: "centre" },
      h("div", { class: "page" },
        h("h1", { class: "t-display" }, "Start a Session"),
        h("p", { class: "muted t-body", style: "margin-top:10px;max-width:62ch" },
          "Both choices below are fixed once the Session begins, and both are "
          + "recorded on it. Sessions are only comparable with Sessions of the "
          + "same chosen duration."),

        h("section", { class: "section" },
          h("div", { class: "section__hd" }, h("h2", { class: "t-label" }, "Track")),
          h("div", { class: "seg", role: "group", "aria-label": "Track" },
            ...[["aiml", "AI/ML Interview Preparation"], ["dsa", "DSA Mastery"]]
              .map(([k, label]) => h("button", {
                class: "seg__btn", "aria-pressed": String(state.track === k),
                onclick: async () => {
                  state.track = k; state.chosen.clear(); state.scope = null;
                  state.modules = await api.modules(k); render();
                },
              }, label)))),

        h("section", { class: "section" },
          h("div", { class: "section__hd spread" },
            h("h2", { class: "t-label" }, "Scope — which Modules"),
            h("span", { class: "t-sm muted" }, "A Module is the unit of scope")),
          h("div", { class: "stack", style: "--gap:8px" },
            ...state.modules.map(ModuleRow)),
          h("p", { class: "t-sm muted", style: "margin-top:12px" },
            s && s.ground_truth_topic_count > 0
              ? `${s.ground_truth_topic_count} Topics in scope carry Answer Keys — those questions grade at full weight.`
              : s
                ? "No Answer Keys in scope. Questions grade from Topic text, at reduced weight."
                : "")),

        h("section", { class: "section" },
          h("div", { class: "section__hd spread" },
            h("h2", { class: "t-label" }, "Duration"),
            h("span", { class: "t-sm muted" }, "Soft deadline")),
          h("div", { class: "seg", role: "group", "aria-label": "Duration" },
            ...DURATIONS.map(([v, label]) => h("button", {
              class: "seg__btn", "aria-pressed": String(state.duration === v),
              onclick: () => { state.duration = v; render(); },
            }, label))),
          h("p", { class: "t-sm muted", style: "margin-top:10px;max-width:62ch" },
            "The Session ends after the Topic you are on finishes, never in the "
            + "middle of one. A half-examined answer would leave a record worse "
            + "than no record.")),

        h("section", { class: "section" },
          h("div", { class: "section__hd spread" },
            h("h2", { class: "t-label" }, "Provider"),
            h("span", { class: "t-sm muted" }, "Your choice, your price")),
          h("div", { class: "stack", style: "--gap:8px" },
            ...(state.prices.length
              ? state.prices
              : ["deepseek", "gemini", "claude"].map((p) =>
                  ({ provider: p, credits_per_visit: 0, observed_visits: 0 })))
              .map(ProviderRow)),
          Notice("info", "We can't quote what this Session will cost.",
            "Topic material varies more than four-fold across Modules, and you "
            + "chose the duration, so the total isn't knowable before it runs. "
            + "The figures above are what your previous Topics actually cost on "
            + "each provider. They are history, not a forecast — you'll see the "
            + "real number after every Topic.")),

        h("section", { class: "section" },
          h("div", { class: "panel panel--flat" }, h("div", { class: "panel__bd spread" },
            h("div", {},
              h("div", { class: "t-label" }, "In scope"),
              h("div", { class: "t-h3", style: "margin-top:4px" },
                s
                  ? `${s.module_count} Module${s.module_count > 1 ? "s" : ""} · ${s.topic_count} Topic${s.topic_count > 1 ? "s" : ""}`
                  : "No Modules chosen"),
              h("div", { class: "t-sm muted", style: "margin-top:6px;max-width:46ch" },
                "A Topic is the unit of load — exactly one is held in context per "
                + "question, however wide the scope runs.")),
            h("span", { class: "chip chip--neutral" },
              `${DURATIONS.find((d) => d[0] === state.duration)[1]} · ${state.provider}`))))),

      h("div", { class: "actionbar" },
        h("a", { class: "btn btn--quiet", href: "/credits.html" }, "Credits"),
        h("button", {
          class: "btn", style: "flex:1", disabled: !canStart,
          "aria-disabled": String(!canStart), onclick: start,
        }, state.starting ? "Starting…" : "Start Session")))));
}

(async function boot() {
  try {
    mount(TopBar({}), h("div", { class: "center" }, Spinner("Loading the Corpus")));
    const [modules, prices] = await Promise.all([
      api.modules(state.track),
      api.providerPrices().catch(() => ({ prices: [] })),
    ]);
    state.modules = modules;
    state.prices = prices.prices || [];
    render();
  } catch (e) {
    mount(TopBar({}), fail(e));
  }
})();
