/* Type-safe query keys. Every cache entry a feature can invalidate is named
   here, so a write in one feature can expire a read in another without either
   importing the other. */

export const queryKeys = {
  health: ["health"] as const,

  corpus: {
    all: ["corpus"] as const,
    tracks: () => [...queryKeys.corpus.all, "tracks"] as const,
    modules: (track: string | undefined, candidateId: string) =>
      [...queryKeys.corpus.all, "modules", track ?? "all", candidateId] as const,
    scope: (moduleIds: readonly string[]) =>
      [...queryKeys.corpus.all, "scope", [...moduleIds].sort().join(",")] as const,
    scopeRelated: (moduleIds: readonly string[]) =>
      [...queryKeys.corpus.all, "scope-related", [...moduleIds].sort().join(",")] as const,
  },

  session: {
    all: ["session"] as const,
    one: (id: string) => [...queryKeys.session.all, id] as const,
    spend: (id: string) => [...queryKeys.session.all, id, "spend"] as const,
    summary: (id: string) => [...queryKeys.session.all, id, "summary"] as const,
  },

  candidate: {
    all: ["candidate"] as const,
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
  },

  providers: { prices: ["providers", "prices"] as const },

  operator: {
    all: ["operator"] as const,
    pool: (token: string) => [...queryKeys.operator.all, "pool", token] as const,
    providers: (token: string) => [...queryKeys.operator.all, "providers", token] as const,
    sessions: (token: string) => [...queryKeys.operator.all, "sessions", token] as const,
  },
} as const;
