import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sessionService } from "@/lib/services/sessions";
import { useSessionUser } from "@/shared/stores/session";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import { useToast } from "@/shared/stores/toasts";

export interface StartInput {
  moduleIds: string[];
  durationSeconds: number;
  provider: string;
}

export function useStartSession() {
  const candidateId = useSessionUser() ?? "anonymous";
  const navigate = useNavigate();
  const remember = useSessionHistory((s) => s.remember);
  const toast = useToast();

  return useMutation({
    mutationFn: (input: StartInput) =>
      sessionService.start({
        candidate_id: candidateId,
        module_ids: input.moduleIds,
        duration_seconds: input.durationSeconds,
        provider: input.provider,
        /* Omitted on purpose. Which key pays is decided from the Key Vault,
           not from the client's word — a Session that billed Credits against
           an attached key would charge twice over. */
        payment_route: null,
      }),
    onSuccess: (data, input) => {
      remember({
        id: data.session_id,
        startedAt: Date.now(),
        moduleCount: input.moduleIds.length,
        durationSeconds: input.durationSeconds,
        state: "running",
      });
      navigate(`/examination/${data.session_id}`, { viewTransition: true });
    },
    onError: (error: Error) => {
      /* Rendered from the API's own message. Composing billing copy here is
         what would let a Credit message reach a BYOK Candidate. */
      toast({ title: "The Session did not start", body: error.message, tone: "risk" });
    },
  });
}
