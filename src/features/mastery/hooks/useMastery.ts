import { useQuery } from "@tanstack/react-query";
import { candidateService } from "@/lib/services/candidate";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { useSessionUser } from "@/shared/stores/session";
import { useLatestSession } from "@/shared/stores/sessionHistory";

export function useConfidence() {
  const candidateId = useSessionUser() ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.candidate.confidence(candidateId),
    queryFn: () => candidateService.confidence(),
  });
}

/* Topics that look weakest, among those with enough evidence to say. Untested
   Topics are absent rather than ranked last: they are unknown, not weak. */
export function useWeakest(limit = 6) {
  const candidateId = useSessionUser() ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.candidate.weakest(candidateId),
    queryFn: () => candidateService.weakest(limit),
  });
}

/* The per-Module untested breakdown is computed over every reading a
   Candidate has, not just one Session's — so the most recent Session's
   summary is a corpus-wide answer to "what has never been asked", and it is
   the only route the contract offers to that question. */
export function useUntestedModules() {
  const latest = useLatestSession();
  return useQuery({
    queryKey: queryKeys.session.summary(latest?.id ?? "none"),
    queryFn: () => sessionService.summary(latest!.id),
    enabled: Boolean(latest?.id),
    select: (summary) => summary.untested_modules,
  });
}


/* Coverage compared as Coverage (ADR-0022).

   A second, separate reading from a separate route. It is never combined with a
   Topic rank into a position, and there is nothing on this screen that could:
   the two are fetched by different hooks and rendered in different places, and
   no function anywhere takes both. */
export function useCoverageStanding() {
  const candidateId = useSessionUser() ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.candidate.coverageStanding(candidateId),
    queryFn: () => candidateService.coverageStanding(),
    enabled: Boolean(candidateId),
  });
}
