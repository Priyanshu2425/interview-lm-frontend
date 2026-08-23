/* Every path the surface knows, in one place. */

const q = (params: Record<string, string | number | undefined | null>): string => {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
};

export const endpoints = {
  health: "/health",

  corpus: {
    tracks: () => "/corpus/tracks",
    modules: (track?: string) => `/corpus/modules${q({ track })}`,
    scope: (moduleIds: readonly string[]) =>
      `/corpus/scope?${moduleIds.map((id) => `module_id=${encodeURIComponent(id)}`).join("&")}`,
    provenance: () => "/corpus/provenance",
    scopeRelated: (moduleIds: readonly string[]) =>
      `/corpus/scope/related?${moduleIds.map((id) => `module_id=${encodeURIComponent(id)}`).join("&")}`,
    topic: (topicId: string) => `/corpus/topics/${topicId}`,
  },

  sessions: {
    create: () => "/sessions",
    one: (id: string) => `/sessions/${id}`,
    turns: (id: string) => `/sessions/${id}/turns`,
    resume: (id: string) => `/sessions/${id}/resume`,
    end: (id: string) => `/sessions/${id}/end`,
    spend: (id: string) => `/sessions/${id}/spend`,
    summary: (id: string) => `/sessions/${id}/summary`,
  },

  /* `me` is not a path segment anybody can write: whose record this is comes
     from the token (ADR-0026). There is no id to pass and none to pass wrongly. */
  candidates: {
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
  },
} as const;
