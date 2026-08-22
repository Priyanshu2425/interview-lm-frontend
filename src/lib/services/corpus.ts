import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type { Module, Scope, Track } from "@/shared/types";

export const corpusService = {
  tracks: () => api.request<Track[]>(endpoints.corpus.tracks()),

  /* The picker asks as the Candidate, so their own notebooks are listed and
     nobody else's are. */
  modules: (candidateId: string, track?: string) =>
    api.request<Module[]>(endpoints.corpus.modules(track, candidateId)),

  scope: (moduleIds: readonly string[]) =>
    moduleIds.length === 0
      ? Promise.resolve<Scope>({
          module_count: 0,
          topic_count: 0,
          ground_truth_topic_count: 0,
          strongest_mode: null,
        })
      : api.request<Scope>(endpoints.corpus.scope(moduleIds)),
};
