import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type { Module, Scope, TouchedModule, Track } from "@/shared/types";

export const skillsService = {
  tracks: () => api.request<Track[]>(endpoints.skills.tracks()),

  /* The picker asks as the Candidate, so their own notebooks are listed and
     nobody else's are — and "as the Candidate" is the token now, not an id the
     caller supplies. */
  modules: (track?: string) =>
    api.request<Module[]>(endpoints.skills.modules(track)),

  scope: (moduleIds: readonly string[]) =>
    moduleIds.length === 0
      ? Promise.resolve<Scope>({
          module_count: 0,
          topic_count: 0,
          ground_truth_topic_count: 0,
          strongest_mode: null,
          suggested_seconds: 0,
          minimum_seconds: 0,
          questions_at_full_coverage: 0,
        })
      : api.request<Scope>(endpoints.skills.scope(moduleIds)),

  /* Which Modules the chosen scope shares material with. Ranked and aggregated
     by the server, because summing edges and ordering the result is deciding
     something and the surface decides nothing (ADR-0009). */
  scopeRelated: (moduleIds: readonly string[]) =>
    moduleIds.length === 0
      ? Promise.resolve<TouchedModule[]>([])
      : api.request<TouchedModule[]>(endpoints.skills.scopeRelated(moduleIds)),
};
