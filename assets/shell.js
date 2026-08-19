/* The shell: the mark, the nav, and the one place a candidate id lives until
   auth arrives (ISSUE-0011 is HITL and the IdP is unchosen). */

import { h } from "./components.js";
import { who } from "./api.js";

const MARK = `<svg class="mark__glyph" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect x="1" y="1" width="22" height="22" rx="6" fill="currentColor"/>
  <path d="M7 15.5c1.2 1.1 2.6 1.6 4.2 1.6 2.3 0 3.6-.9 3.6-2.3 0-1.3-1-1.9-3.3-2.4l-1.3-.3C8 11.6 6.9 10.5 6.9 8.7c0-2.2 1.9-3.7 4.7-3.7 1.6 0 3 .4 4.1 1.3"
        stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>`;

export function TopBar({ ink = false, title, sub, back, right } = {}) {
  return h("header", { class: `topbar${ink ? " on-ink" : ""}` },
    back
      ? h("a", { class: "iconbtn", href: back, "aria-label": "Back",
                 html: `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>` })
      : h("a", { class: "mark", href: "/", style: "color:var(--primary)",
                 html: `${MARK}<span class="mark__name" style="color:var(--text)">Cortex Interviewer</span>` }),
    title
      ? h("div", { style: "min-width:0" },
          h("div", { class: "topbar__title" }, title),
          sub ? h("div", { class: "topbar__sub" }, sub) : null)
      : null,
    h("div", { class: "topbar__spacer" }),
    right || null);
}

export function mount(...nodes) {
  const app = document.getElementById("app");
  app.replaceChildren(...nodes.flat().filter(Boolean));
  return app;
}

export function candidateBadge() {
  return h("span", { class: "chip chip--neutral mono", title: "signed in as" },
    who.id.slice(0, 14));
}

export function fail(err) {
  return h("div", { class: "center" },
    h("div", { class: "notice notice--danger", style: "max-width:52ch;text-align:left" },
      h("div", {},
        h("div", { class: "notice__title" }, "That did not work"),
        h("div", { class: "notice__body" }, err?.message || String(err)))),
    h("a", { class: "btn btn--quiet", href: "/" }, "Start again"));
}
