/* ISSUE-0019 — the operator console.

   Pool headroom leads because it is the only figure that can strand a Candidate
   mid-Session. Everything reads off records that already exist; the screen adds
   no instrumentation. */

import { api } from "./api.js";
import { h, Notice, Spinner } from "./components.js";
import { TopBar, fail, mount } from "./shell.js";

const TOKEN_KEY = "operator_token";
const S = { token: localStorage.getItem(TOKEN_KEY) || "", data: null, error: null };

function Stat(v, label, tone) {
  return h("div", { class: "panel" }, h("div", { class: "panel__bd" },
    h("div", { class: "t-label" }, label),
    h("div", { class: "num", style: `font-size:1.75rem;font-weight:500;margin-top:4px${tone ? `;color:var(--${tone})` : ""}` },
      String(v))));
}

function render() {
  const { pool, providers, sessions } = S.data;

  mount(
    TopBar({ right: h("span", { class: "chip chip--neutral" }, "Internal") }),
    h("div", { class: "main" }, h("div", { class: "centre" },
      h("div", { class: "page page--wide" },
        h("h1", { class: "t-display" }, "Pool, metering, providers"),

        h("section", { class: "section" },
          h("div", { class: "panel" }, h("div", { class: "panel__bd" },
            h("div", { class: "spread", style: "align-items:flex-start;gap:24px;flex-wrap:wrap" },
              h("div", {},
                h("div", { class: "t-label" }, "Pool headroom"),
                h("div", { class: "num",
                  style: `font-size:2.25rem;font-weight:500;letter-spacing:-.03em;line-height:1.1;color:var(--${pool.alert ? "danger" : "success"})` },
                  `${pool.headroom >= 0 ? "+" : ""}${pool.headroom.toLocaleString()}`),
                h("div", { class: "t-sm muted" },
                  "Credits · pool minus the sum of all Candidate balances")),
              h("div", { style: "flex:1;min-width:220px" },
                ...[["OpenRouter pool", pool.pool],
                    ["Σ Candidate balances", pool.sum_balances],
                    ["Float (working capital)", `$${pool.float_usd}`],
                    ["Drawdown divergence", pool.divergence]]
                  .map(([k, v]) => h("div", { class: "spread", style: "margin-top:7px" },
                    h("span", { class: "t-sm muted" }, k),
                    h("span", { class: "num t-sm" }, String(v)))))),
            pool.alert
              ? Notice("warn", "Pool headroom is below its threshold",
                  "Top up ahead of receipts. Pre-funding is what keeps a Candidate "
                  + "with a positive balance from ever being blocked by an empty pool.")
              : Notice("ok", "Invariant holds by construction, not by reconciliation",
                  "The pool is funded ahead of receipts and Credits are granted only "
                  + "once payment clears, so settlement lag, a failed card and a "
                  + "refund are all incapable of starving it.")))),

        h("section", { class: "section" },
          h("div", { class: "section__hd spread" },
            h("h2", { class: "t-h2" }, "By Provider"),
            h("span", { class: "t-sm muted" },
              `unpriced call rate ${(providers.unpriced_rate * 100).toFixed(1)}%`)),
          providers.providers.length
            ? h("div", { class: "panel" },
                h("div", { class: "scroll-note" }, "Scroll for more columns"),
                h("div", { class: "scroll-x" },
                  h("table", { class: "tbl" },
                    h("thead", {}, h("tr", {},
                      h("th", { style: "min-width:120px" }, "Provider"),
                      h("th", { class: "tbl__num" }, "Visits"),
                      h("th", { class: "tbl__num" }, "Credits"),
                      h("th", { class: "tbl__num" }, "Cr / Visit"),
                      h("th", { class: "tbl__num" }, "Unpriced"),
                      h("th", { class: "tbl__num" }, "Failures"))),
                    h("tbody", {}, ...providers.providers.map((p) => h("tr", {},
                      h("td", {}, h("strong", {}, p.provider)),
                      h("td", { class: "tbl__num" }, String(p.visits)),
                      h("td", { class: "tbl__num" }, String(p.credits)),
                      h("td", { class: "tbl__num" }, String(p.credits_per_visit)),
                      h("td", { class: "tbl__num",
                        style: p.unpriced_rate > 0.02 ? "color:var(--warning);font-weight:600" : "" },
                        `${(p.unpriced_rate * 100).toFixed(1)}%`),
                      h("td", { class: "tbl__num" },
                        `${(p.failure_rate * 100).toFixed(1)}%`)))))),
                h("div", { class: "panel__ft" },
                  h("p", { class: "t-sm muted", style: "margin:0;max-width:78ch" },
                    "Cost per Visit varies across providers and the grading weights "
                    + "do not move with it. There is no normaliser here and there "
                    + "will not be one until production data supports it — a fitted "
                    + "constant with nothing behind it would make every posterior "
                    + "uninterpretable.")))
            : h("p", { class: "t-sm muted" }, "No metered calls yet.")),

        h("section", { class: "section" },
          h("div", { class: "section__hd" }, h("h2", { class: "t-h2" }, "Sessions")),
          h("div", { class: "panel" },
            h("div", { class: "scroll-note" }, "Scroll for more columns"),
            h("div", { class: "scroll-x" },
              h("table", { class: "tbl" },
                h("thead", {}, h("tr", {},
                  h("th", { style: "min-width:180px" }, "Session"),
                  h("th", { style: "width:100px" }, "Route"),
                  h("th", { class: "tbl__num" }, "Visits"),
                  h("th", { class: "tbl__num" }, "Credits"),
                  h("th", { class: "tbl__num" }, "Refunded"),
                  h("th", { style: "width:140px" }, "Ended"))),
                h("tbody", {}, ...sessions.sessions.map((r) => h("tr", {},
                  h("td", { class: "mono t-sm" }, r.session_id.slice(0, 18) + "…"),
                  h("td", {}, h("span", { class: "tag" }, r.route)),
                  h("td", { class: "tbl__num" }, String(r.visits)),
                  /* BYOK and MCP carry null, never 0 */
                  h("td", { class: "tbl__num" }, r.credits === null ? "—" : String(r.credits)),
                  h("td", { class: "tbl__num" }, r.refunded === null ? "—" : String(r.refunded)),
                  h("td", {}, h("span", { class: "chip chip--neutral" },
                    (r.ended || "").replace(/_/g, " ")))))))),
            h("div", { class: "panel__ft" },
              h("p", { class: "t-sm muted", style: "margin:0" },
                "BYOK and MCP rows carry an em dash rather than a zero. Zero would "
                + "read as a Session that cost nothing; these are Sessions on a "
                + "ledger we don't hold."))))))));
}

function askToken() {
  mount(TopBar({}), h("div", { class: "main" }, h("div", { class: "centre" },
    h("div", { class: "page", style: "max-width:420px" },
      h("h1", { class: "t-h2" }, "Operator access"),
      h("p", { class: "t-sm muted", style: "margin-top:8px" },
        "This console is authenticated separately from Candidate access."),
      h("form", { style: "margin-top:16px", onsubmit: (e) => {
          e.preventDefault();
          S.token = e.target.querySelector("input").value.trim();
          localStorage.setItem(TOKEN_KEY, S.token);
          boot();
        } },
        h("input", { class: "input mono", type: "password", required: true,
                     placeholder: "operator token", autocomplete: "off" }),
        h("button", { class: "btn", type: "submit", style: "margin-top:12px" },
          "Open console")),
      S.error ? Notice("danger", "Refused", S.error) : null))));
}

async function boot() {
  if (!S.token) return askToken();
  try {
    mount(TopBar({}), h("div", { class: "center" }, Spinner("Reading the ledgers")));
    const [pool, providers, sessions] = await Promise.all([
      api.operator.pool(S.token),
      api.operator.providers(S.token),
      api.operator.sessions(S.token),
    ]);
    S.data = { pool, providers, sessions };
    S.error = null;
    render();
  } catch (e) {
    S.error = e.status === 401 ? "That token was not accepted." : e.message;
    S.token = "";
    localStorage.removeItem(TOKEN_KEY);
    askToken();
  }
}
boot();
