import { useQuery } from "@tanstack/react-query";
import { skillsService } from "@/lib/services/skills";
import { queryKeys } from "@/lib/query-keys";
import { useSessionUser } from "@/shared/stores/session";

export function useModules(track?: string) {
  const candidateId = useSessionUser() ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.skills.modules(track, candidateId),
    queryFn: () => skillsService.modules(track),
  });
}

export function useTracks() {
  return useQuery({
    queryKey: queryKeys.skills.tracks(),
    queryFn: () => skillsService.tracks(),
    staleTime: 5 * 60_000,
  });
}

/* Scope is the server's count, not a sum taken here: a Module's Topics can
   overlap another's, and adding the two numbers would report a corpus larger
   than the one being examined. */
export function useScope(moduleIds: readonly string[]) {
  return useQuery({
    queryKey: queryKeys.skills.scope(moduleIds),
    queryFn: () => skillsService.scope(moduleIds),
    enabled: moduleIds.length > 0,
  });
}

/* Which Modules the chosen scope touches (ADR-0023). A reading of the material,
   asked for at the one moment nothing has been measured about the Candidate. */
export function useScopeRelated(moduleIds: readonly string[]) {
  return useQuery({
    queryKey: queryKeys.skills.scopeRelated(moduleIds),
    queryFn: () => skillsService.scopeRelated(moduleIds),
    enabled: moduleIds.length > 0,
  });
}
