import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type { Module, Scope, TouchedModule, Track } from "@/shared/types";

export const corpusService = {
  tracks: () => api.request<Track[]>(endpoints.corpus.tracks()),

  /* The picker asks as the Candidate, so their own notebooks are listed and
     nobody else's are — and "as the Candidate" is the token now, not an id the
     caller supplies. */
  modules: (track?: string) =>
    api.request<Module[]>(endpoints.corpus.modules(track)),

  scope: (moduleIds: readonly string[]) =>
    moduleIds.length === 0
      ? Promise.resolve<Scope>({
          module_count: 0,
          topic_count: 0,
          ground_truth_topic_count: 0,
          strongest_mode: null,
        })
      : api.request<Scope>(endpoints.corpus.scope(moduleIds)),

  /* Which Modules the chosen scope shares material with. Ranked and aggregated
     by the server, because summing edges and ordering the result is deciding
     something and the surface decides nothing (ADR-0009). */
  scopeRelated: (moduleIds: readonly string[]) =>
    moduleIds.length === 0
      ? Promise.resolve<TouchedModule[]>([])
      : api.request<TouchedModule[]>(endpoints.corpus.scopeRelated(moduleIds)),
};
