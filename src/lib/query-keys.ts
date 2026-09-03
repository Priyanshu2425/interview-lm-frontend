/* Type-safe query keys. Every cache entry a feature can invalidate is named
   here, so a write in one feature can expire a read in another without either
   importing the other. */

export const queryKeys = {
  health: ["health"] as const,

  skills: {
    all: ["skills"] as const,
    tracks: () => [...queryKeys.skills.all, "tracks"] as const,
    modules: (track: string | undefined, candidateId: string) =>
      [...queryKeys.skills.all, "modules", track ?? "all", candidateId] as const,
    scope: (moduleIds: readonly string[]) =>
      [...queryKeys.skills.all, "scope", [...moduleIds].sort().join(",")] as const,
    scopeRelated: (moduleIds: readonly string[]) =>
      [...queryKeys.skills.all, "scope-related", [...moduleIds].sort().join(",")] as const,
  },

  session: {
    all: ["session"] as const,
    list: (candidateId: string) => [...queryKeys.session.all, "list", candidateId] as const,
    one: (id: string) => [...queryKeys.session.all, id] as const,
    spend: (id: string) => [...queryKeys.session.all, id, "spend"] as const,
    summary: (id: string) => [...queryKeys.session.all, id, "summary"] as const,
    plan: (id: string) => [...queryKeys.session.all, id, "plan"] as const,
    transcript: (id: string) => [...queryKeys.session.all, id, "transcript"] as const,
    report: (id: string) => [...queryKeys.session.all, id, "report"] as const,
  },

  candidate: {
    all: ["candidate"] as const,
    me: (id: string) => [...queryKeys.candidate.all, id, "me"] as const,
    confidence: (id: string) => [...queryKeys.candidate.all, id, "confidence"] as const,
    weakest: (id: string) => [...queryKeys.candidate.all, id, "weakest"] as const,
    credits: (id: string) => [...queryKeys.candidate.all, id, "credits"] as const,
    topicStanding: (id: string, topicId: string) =>
      [...queryKeys.candidate.all, id, "standing", topicId] as const,
    coverageStanding: (id: string) =>
      [...queryKeys.candidate.all, id, "coverage-standing"] as const,
  },

  notebooks: {
    all: ["notebooks"] as const,
    list: (candidateId: string) => [...queryKeys.notebooks.all, candidateId] as const,
    one: (notebookId: string) => [...queryKeys.notebooks.all, "one", notebookId] as const,
    /* Nested under `one` on purpose: invalidating a notebook expires the
       documents read out of it by prefix, so a retry refreshes the list and
       the open document without either naming the other. */
    source: (notebookId: string, sourceId: string) =>
      [...queryKeys.notebooks.one(notebookId), "source", sourceId] as const,
  },

  providers: { prices: ["providers", "prices"] as const },

  operator: {
    all: ["operator"] as const,
    pool: (token: string) => [...queryKeys.operator.all, "pool", token] as const,
    providers: (token: string) => [...queryKeys.operator.all, "providers", token] as const,
    sessions: (token: string) => [...queryKeys.operator.all, "sessions", token] as const,
    skills: (token: string) => [...queryKeys.operator.all, "skills", token] as const,
    skill: (token: string, id: string) => [...queryKeys.operator.all, "skills", token, id] as const,
  },
} as const;
