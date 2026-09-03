import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { candidateService } from "@/lib/services/candidate";
import { queryKeys } from "@/lib/query-keys";
import { useSessionUser } from "@/shared/stores/session";
import type { CandidateProfile, OnboardingInput } from "@/shared/types";

/* Who is signed in, and whether they have ever said so (ISSUE-0048).

   No `candidate_id` is involved anywhere: every route here is `/me`, and whose
   record it is comes from the token that carried the request. The id in the
   query key is the Gatehouse subject, and it is there to scope the cache to a
   browser profile rather than to address anybody. */
export function useProfile() {
  const userId = useSessionUser() ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.candidate.me(userId),
    queryFn: () => candidateService.me(),
    staleTime: Infinity,
    retry: 1,
  });
}

/* The four fields the form collects, and only those.
   The route forbids unknown keys — a stray one is a 422 rather than a silent
   drop — and leaves omitted keys alone, so an empty answer is *not sent* and
   the record keeps whatever it already had. */
const FIELDS = ["display_name", "target_role", "experience_level", "goal"] as const;

export function onboardingBody(form: Record<string, string>): OnboardingInput {
  const body: OnboardingInput = {};
  for (const key of FIELDS) {
    const value = (form[key] ?? "").trim();
    if (value) body[key] = value;
  }
  return body;
}

export function useOnboard() {
  const userId = useSessionUser() ?? "anonymous";
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: Record<string, string>) =>
      candidateService.onboard(onboardingBody(form)),
    onSuccess: (profile: CandidateProfile) => {
      /* Written, not invalidated: a refetch would race the redirect out of
         the form, and the gate would send them straight back into it. */
      queryClient.setQueryData(queryKeys.candidate.me(userId), profile);
    },
  });
}
