/* ISSUE-0018 — Credits and BYOK.

   The rule that matters most here: the surface composes NO billing copy. Every
   failure message is rendered from the API's own `code` and `message`, because
   composing our own is exactly where a Credit message leaks onto a BYOK
   Candidate — someone who spends no Credits at all. */

import { api, who } from "./api.js";
import { h, Notice, Spinner } from "./components.js";
import { TopBar, candidateBadge, fail, mount } from "./shell.js";

const S = { data: null, busy: false, error: null };

function LedgerRow(r) {
  const positive = r.delta_credits > 0;
  const label = { grant: "Added", promo_grant: "Promotional", debit: "Topic Visit",
                  refund: "Refund — our failure" }[r.entry_type] || r.entry_type;
  return h("tr", { style: r.entry_type === "refund"
      ? "background:var(--success-bg)" : "" },
    h("td", {},
      h("div", { style: "font-weight:600" }, label),
      r.topic_visit_id
        ? h("div", { class: "t-sm muted mono" }, r.topic_visit_id.slice(0, 20) + "…")
        : null),
    h("td", { class: "tbl__num", style: positive ? "color:var(--success);font-weight:600" : "" },
      `${positive ? "+" : ""}${r.delta_credits}`),
    h("td", { class: "t-sm muted" }, new Date(r.created_at).toLocaleString()));
}

async function attach(key) {
  S.busy = true; S.error = null; render();
  try {
    await api.attachKey(who.id, key);
    S.data = await api.credits(who.id);
  } catch (e) {
    /* Rendered verbatim. The API decides what this says — see the note above. */
    S.error = e.message;
  }
  S.busy = false; render();
}

async function revoke(keyId) {
  S.busy = true; render();
  try { await api.revokeKey(keyId); S.data = await api.credits(who.id); }
  catch (e) { S.error = e.message; }
  S.busy = false; render();
}

async function topUp() {
  S.busy = true; render();
  try {
    await api.grant(who.id, 20000, `top-${Date.now()}`);
    S.data = await api.credits(who.id);
  } catch (e) { S.error = e.message; }
  S.busy = false; render();
}

function render() {
  const d = S.data;
  const byok = d.route === "byok";

  mount(
    TopBar({ right: candidateBadge() }),
    h("div", { class: "main" }, h("div", { class: "centre" },
      h("div", { class: "page page--wide" },
        h("h1", { class: "t-display" }, "Credits & keys"),

        h("section", { class: "section" },
          h("div", { class: "panel" }, h("div", { class: "panel__bd" },
            h("div", { class: "spread", style: "align-items:flex-start;gap:20px;flex-wrap:wrap" },
              h("div", {},
                h("div", { class: "t-label" }, "Balance"),
                h("div", { class: "num", style: "font-size:2.25rem;font-weight:500;letter-spacing:-.03em;line-height:1.1" },
                  /* null under BYOK, never 0 — zero reads as "it was free". */
                  byok ? "—" : String(d.balance)),
                h("div", { class: "t-sm muted" },
                  byok
                    ? "You're on your own key. No Credits are spent."
                    : `about $${(d.balance / 100).toFixed(2)} of provider cost`)),
              byok ? null : h("button", { class: "btn", onclick: topUp, disabled: S.busy },
                S.busy ? "Working…" : "Add Credits")),
            byok ? null : Notice("info", "One Credit is one US cent of provider cost.",
              "Not a house currency and not an average, but the exact figure the "
              + "provider billed for your call. This is why the same Topic costs "
              + "different amounts on DeepSeek, Gemini and Claude, and why "
              + "choosing a cheaper provider visibly stretches a balance."),
            !byok && d.low_balance
              ? Notice("warn", "Your balance is running low",
                  "Top up before a Session ends on you. A Session parks cleanly "
                  + "when Credits run out — the Topic you are on always finishes.")
              : null))),

        !byok && d.ledger.length
          ? h("section", { class: "section" },
              h("div", { class: "section__hd spread" },
                h("h2", { class: "t-h2" }, "Where it went"),
                h("span", { class: "t-sm muted" }, "Metered per call, shown per Topic")),
              h("div", { class: "panel" },
                h("div", { class: "scroll-note" }, "Scroll for more columns"),
                h("div", { class: "scroll-x" },
                  h("table", { class: "tbl" },
                    h("thead", {}, h("tr", {},
                      h("th", { style: "min-width:200px" }, "Entry"),
                      h("th", { class: "tbl__num", style: "width:110px" }, "Credits"),
                      h("th", { style: "width:180px" }, "When"))),
                    h("tbody", {}, ...d.ledger.slice().reverse().map(LedgerRow)))),
                h("div", { class: "panel__ft" },
                  h("p", { class: "t-sm muted", style: "margin:0;max-width:74ch" },
                    "A Topic that never got graded still cost money to attempt, so "
                    + "it stays on the ledger — and a refund is its own line rather "
                    + "than a number quietly edited."))))
          : null,

        h("section", { class: "section" },
          h("div", { class: "section__hd spread" },
            h("h2", { class: "t-h2" }, "Use your own key"),
            h("span", { class: "chip chip--neutral" }, "OpenRouter only")),
          h("div", { class: "panel" }, h("div", { class: "panel__bd stack", style: "--gap:16px" },
            byok
              ? h("div", {},
                  h("div", { class: "row row--wrap", style: "gap:10px" },
                    h("span", { class: "chip", style: "background:var(--success-bg);color:var(--success)" },
                      h("span", { class: "chip__dot" }), "Active · validated"),
                    h("span", { class: "chip chip--neutral mono" },
                      `fp ${d.byok.fingerprint}`),
                    h("button", { class: "btn btn--sm btn--quiet", style: "margin-left:auto",
                      onclick: () => revoke(d.byok.key_id), disabled: S.busy },
                      "Remove key")),
                  h("div", { class: "readings", style: "margin-top:16px" },
                    h("div", { class: "reading" },
                      h("div", { class: "reading__label" }, "Credits spent"),
                      /* null, not 0 */
                      h("div", { class: "reading__value" }, "—"),
                      h("div", { class: "reading__note" },
                        "You're on your own key. None are spent."))))
              : h("form", { onsubmit: (e) => {
                    e.preventDefault();
                    attach(e.target.querySelector("input").value.trim());
                  } },
                  h("label", { class: "field__label", for: "k" }, "OpenRouter API key"),
                  h("input", { class: "input mono", id: "k", type: "text",
                    placeholder: "sk-or-v1-…", autocomplete: "off", required: true }),
                  h("p", { class: "field__help" },
                    "Checked against OpenRouter the moment you paste it, so a dead "
                    + "key fails here rather than halfway through a Session."),
                  h("button", { class: "btn", style: "margin-top:12px", type: "submit",
                                disabled: S.busy }, S.busy ? "Checking…" : "Attach key")),
            S.error ? Notice("danger", "That key was refused", S.error) : null,
            Notice("info", "Why only OpenRouter keys",
              "An OpenRouter key carries its own spend cap and can be revoked on "
              + "its own. A raw Anthropic, Google or DeepSeek credential can't, so "
              + "we don't accept one and there is no field here that would take it. "
              + "Grading still runs on our side: if your machine produced the "
              + "score, every record in the system would be forgeable.")))),

        h("section", { class: "section" },
          h("a", { class: "btn btn--quiet", href: "/" }, "Back to Sessions"))))));
}

(async function boot() {
  try {
    mount(TopBar({}), h("div", { class: "center" }, Spinner("Reading your ledger")));
    S.data = await api.credits(who.id);
    render();
  } catch (e) { mount(TopBar({}), fail(e)); }
})();
