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
    modules: (track?: string, candidateId?: string) =>
      `/corpus/modules${q({ track, candidate_id: candidateId })}`,
    scope: (moduleIds: readonly string[]) =>
      `/corpus/scope?${moduleIds.map((id) => `module_id=${encodeURIComponent(id)}`).join("&")}`,
    provenance: (candidateId?: string) => `/corpus/provenance${q({ candidate_id: candidateId })}`,
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

  candidates: {
    confidence: (id: string) => `/candidates/${id}/confidence`,
    weakest: (id: string, limit = 10) => `/candidates/${id}/weakest${q({ limit })}`,
    credits: (id: string) => `/candidates/${id}/credits`,
    topicStanding: (id: string, topicId: string) =>
      `/candidates/${id}/topics/${topicId}/standing`,
    coverageStanding: (id: string) => `/candidates/${id}/coverage-standing`,
    attachKey: () => "/candidates/me/byok",
    revokeKey: (keyId: string) => `/candidates/me/byok/${keyId}`,
  },

  credits: { grants: () => "/credits/grants" },
  providers: { prices: () => "/providers/prices" },

  notebooks: {
    list: (candidateId: string) => `/notebooks${q({ candidate_id: candidateId })}`,
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
