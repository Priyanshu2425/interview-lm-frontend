/* Every path the surface knows, in one place. */

const q = (params: Record<string, string | number | undefined | null>): string => {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
};

export const endpoints = {
  health: "/health",

  skills: {
    tracks: () => "/skills/tracks",
    modules: (track?: string) => `/skills/modules${q({ track })}`,
    scope: (moduleIds: readonly string[]) =>
      `/skills/scope?${moduleIds.map((id) => `module_id=${encodeURIComponent(id)}`).join("&")}`,
    provenance: () => "/skills/provenance",
    scopeRelated: (moduleIds: readonly string[]) =>
      `/skills/scope/related?${moduleIds.map((id) => `module_id=${encodeURIComponent(id)}`).join("&")}`,
    topic: (topicId: string) => `/skills/topics/${topicId}`,
  },

  sessions: {
    list: () => "/sessions",
    create: () => "/sessions",
    /* Not the same moment as `create`. The Session exists first, because the
       plan is fixed before anything can be asked; the clock starts here, when
       the Candidate says they are ready (ISSUE-0050). */
    begin: (id: string) => `/sessions/${id}/begin`,
    one: (id: string) => `/sessions/${id}`,
    turns: (id: string) => `/sessions/${id}/turns`,
    resume: (id: string) => `/sessions/${id}/resume`,
    end: (id: string) => `/sessions/${id}/end`,
    spend: (id: string) => `/sessions/${id}/spend`,
    summary: (id: string) => `/sessions/${id}/summary`,
    /* Fixed before the first question, and byte-identical on every read. */
    plan: (id: string) => `/sessions/${id}/plan`,
    transcript: (id: string) => `/sessions/${id}/transcript`,
    /* The one place a Session's result is shown, now that no turn carries a
       score (ISSUE-0045). */
    report: (id: string) => `/sessions/${id}/report`,
  },

  /* `me` is not a path segment anybody can write: whose record this is comes
     from the token (ADR-0026). There is no id to pass and none to pass wrongly. */
  candidates: {
    me: () => "/candidates/me",
    confidence: () => "/candidates/me/confidence",
    weakest: (limit = 10) => `/candidates/me/weakest${q({ limit })}`,
    credits: () => "/candidates/me/credits",
    topicStanding: (topicId: string) => `/candidates/me/topics/${topicId}/standing`,
    coverageStanding: () => "/candidates/me/coverage-standing",
    attachKey: () => "/candidates/me/byok",
    revokeKey: (keyId: string) => `/candidates/me/byok/${keyId}`,
  },

  credits: { grants: () => "/credits/grants" },
  providers: { prices: () => "/providers/prices" },

  notebooks: {
    list: () => "/notebooks",
    create: () => "/notebooks",
    one: (id: string) => `/notebooks/${id}`,
    sources: (id: string) => `/notebooks/${id}/sources`,
    files: (id: string) => `/notebooks/${id}/files`,
    source: (id: string, sourceId: string) => `/notebooks/${id}/sources/${sourceId}`,
    retry: (id: string, sourceId: string) => `/notebooks/${id}/sources/${sourceId}/retry`,
  },

  operator: {
    pool: () => "/operator/pool",
    providers: () => "/operator/providers",
    sessions: () => "/operator/sessions",
    skills: () => "/operator/skills",
    skill: (id: string) => `/operator/skills/${id}`,
    skillFiles: (id: string) => `/operator/skills/${id}/files`,
    skillActive: (id: string) => `/operator/skills/${id}/active`,
  },
} as const;
