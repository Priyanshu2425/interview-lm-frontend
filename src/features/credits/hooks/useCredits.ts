import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { candidateService } from "@/lib/services/candidate";
import { queryKeys } from "@/lib/query-keys";
import { useCandidateId } from "@/shared/stores/identity";
import { useToast } from "@/shared/stores/toasts";

export function useCredits() {
  const candidateId = useCandidateId();
  return useQuery({
    queryKey: queryKeys.candidate.credits(candidateId),
    queryFn: () => candidateService.credits(candidateId),
  });
}

/* History, not a forecast: what previous Topics actually cost per Provider.
   There is no route that estimates what a Session will cost, and this is not
   one pretending otherwise. */
export function usePrices() {
  return useQuery({
    queryKey: queryKeys.providers.prices,
    queryFn: () => candidateService.prices(),
    staleTime: 5 * 60_000,
  });
}

export function useKeyMutations() {
  const candidateId = useCandidateId();
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.candidate.credits(candidateId) });
  };

  const attach = useMutation({
    mutationFn: (key: string) => candidateService.attachKey(candidateId, key),
    onSuccess: (k) => {
      invalidate();
      toast({
        title: "Key attached",
        body: `${k.fingerprint} · your Provider bills you directly from now on.`,
        tone: "ok",
      });
    },
    /* The API refuses a malformed or wrong-provider key by name. Rewriting
       that message here is how a Credit message would reach a BYOK
       Candidate, so it is passed through untouched. */
    onError: (e: Error) => toast({ title: "That key was refused", body: e.message, tone: "risk" }),
  });

  const revoke = useMutation({
    mutationFn: (keyId: string) => candidateService.revokeKey(keyId),
    onSuccess: () => {
      invalidate();
      toast({ title: "Key revoked", body: "New Sessions go back onto Credits." });
    },
    onError: (e: Error) => toast({ title: "It was not revoked", body: e.message, tone: "risk" }),
  });

  return { attach, revoke };
}
