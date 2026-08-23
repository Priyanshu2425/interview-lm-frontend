import { useQuery } from "@tanstack/react-query";
import { corpusService } from "@/lib/services/corpus";
import { queryKeys } from "@/lib/query-keys";
import { useCandidateId } from "@/shared/stores/identity";

export function useModules(track?: string) {
  const candidateId = useCandidateId();
  return useQuery({
    queryKey: queryKeys.corpus.modules(track, candidateId),
    queryFn: () => corpusService.modules(candidateId, track),
  });
}

export function useTracks() {
  return useQuery({
    queryKey: queryKeys.corpus.tracks(),
    queryFn: () => corpusService.tracks(),
    staleTime: 5 * 60_000,
  });
}

/* Scope is the server's count, not a sum taken here: a Module's Topics can
   overlap another's, and adding the two numbers would report a corpus larger
   than the one being examined. */
export function useScope(moduleIds: readonly string[]) {
  return useQuery({
    queryKey: queryKeys.corpus.scope(moduleIds),
    queryFn: () => corpusService.scope(moduleIds),
    enabled: moduleIds.length > 0,
  });
}

/* Which Modules the chosen scope touches (ADR-0023). A reading of the material,
   asked for at the one moment nothing has been measured about the Candidate. */
export function useScopeRelated(moduleIds: readonly string[]) {
  return useQuery({
    queryKey: queryKeys.corpus.scopeRelated(moduleIds),
    queryFn: () => corpusService.scopeRelated(moduleIds),
    enabled: moduleIds.length > 0,
  });
}
