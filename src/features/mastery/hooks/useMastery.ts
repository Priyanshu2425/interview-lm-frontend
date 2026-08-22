import { useQuery } from "@tanstack/react-query";
import { candidateService } from "@/lib/services/candidate";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { useCandidateId } from "@/shared/stores/identity";
import { useLatestSession } from "@/shared/stores/sessionHistory";

export function useConfidence() {
  const candidateId = useCandidateId();
  return useQuery({
    queryKey: queryKeys.candidate.confidence(candidateId),
    queryFn: () => candidateService.confidence(candidateId),
  });
}

/* Topics that look weakest, among those with enough evidence to say. Untested
   Topics are absent rather than ranked last: they are unknown, not weak. */
export function useWeakest(limit = 6) {
  const candidateId = useCandidateId();
  return useQuery({
    queryKey: queryKeys.candidate.weakest(candidateId),
    queryFn: () => candidateService.weakest(candidateId, limit),
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
