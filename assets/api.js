/* The API client. The surface holds no invariant (ADR-0009): it supplies an
   Answer Turn and renders what it is given.

   Three things it deliberately does NOT do:
     - compute a score, a band, or a posterior. Those arrive decided.
     - decide what to ask next. Topic selection lives in the graph.
     - hold an Answer Key. There is no route that would return one. */

const BASE = "/v1";

async function req(path, { method = "GET", body, headers = {} } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
  if (!r.ok) {
    const err = new Error(data?.detail || `${r.status} ${r.statusText}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* One idempotency key per composed answer, reused on every retry. A mashed
   submit button, a flaky network and a browser refresh all converge on one
   Answer Turn — which is the whole reason ADR-0011 chose a request. */
function turnKey(sessionId, turnIndex) {
  return `${sessionId}:${turnIndex}`;
}

export const api = {
  health: () => req("/health"),

  modules: (track) => req(`/corpus/modules${track ? `?track=${track}` : ""}`),
  tracks: () => req("/corpus/tracks"),
  scope: (ids) =>
    req("/corpus/scope?" + ids.map((i) => `module_id=${encodeURIComponent(i)}`).join("&")),
  providerPrices: () => req("/providers/prices"),

  startSession: (payload) => req("/sessions", { method: "POST", body: payload }),
  submitTurn: (sessionId, answer, turnIndex) =>
    req(`/sessions/${sessionId}/turns`, {
      method: "POST",
      body: { answer },
      headers: { "Idempotency-Key": turnKey(sessionId, turnIndex) },
    }),
  session: (id) => req(`/sessions/${id}`),
  resume: (id) => req(`/sessions/${id}/resume`, { method: "POST" }),
  endSession: (id) => req(`/sessions/${id}/end`, { method: "POST" }),
  spend: (id) => req(`/sessions/${id}/spend`),
  summary: (id) => req(`/sessions/${id}/summary`),

  confidence: (cid) => req(`/candidates/${cid}/confidence`),
  weakest: (cid) => req(`/candidates/${cid}/weakest`),
  credits: (cid) => req(`/candidates/${cid}/credits`),
  attachKey: (cid, key) =>
    req("/candidates/me/byok", {
      method: "POST",
      body: { candidate_id: cid, openrouter_key: key },
    }),
  revokeKey: (keyId) => req(`/candidates/me/byok/${keyId}`, { method: "DELETE" }),
  grant: (cid, credits, ref) =>
    req("/credits/grants", {
      method: "POST",
      body: { candidate_id: cid, credits, payment_ref: ref },
    }),

  operator: {
    pool: (t) => req("/operator/pool", { headers: { "x-operator-token": t } }),
    providers: (t) => req("/operator/providers", { headers: { "x-operator-token": t } }),
    sessions: (t) => req("/operator/sessions", { headers: { "x-operator-token": t } }),
  },
};

/* -- who is signed in ------------------------------------------------------
   Auth is not built (ISSUE-0011 is HITL, the IdP is unchosen), so the surface
   carries a candidate id it was given. This is the one place that changes when
   real auth lands. */
export const who = {
  get id() {
    let v = localStorage.getItem("candidate_id");
    if (!v) {
      v = "cand_" + Math.random().toString(36).slice(2, 12);
      localStorage.setItem("candidate_id", v);
    }
    return v;
  },
  set id(v) { localStorage.setItem("candidate_id", v); },
};

export const els = (sel, root = document) => [...root.querySelectorAll(sel)];
export const el = (sel, root = document) => root.querySelector(sel);

export function fmt(n) {
  return n === null || n === undefined ? "—" : String(n);
}

/* A band arrives already decided. The surface only maps it to a class. */
export const BAND_CLASS = {
  untested: "band--untested",
  early: "band--hedged",
  firm_weak: "band--firm-weak",
  firm_strong: "band--firm-strong",
};

export function bandEl(band, label) {
  const s = document.createElement("span");
  s.className = `band ${BAND_CLASS[band] || "band--untested"}`;
  s.innerHTML = `<span class="band__mark"></span>${label}`;
  return s;
}

export function toast(message, kind = "info") {
  let host = el("#toasts");
  if (!host) {
    host = document.createElement("div");
    host.id = "toasts";
    document.body.appendChild(host);
  }
  const t = document.createElement("div");
  t.className = `toast toast--${kind}`;
  t.textContent = message;
  host.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}
