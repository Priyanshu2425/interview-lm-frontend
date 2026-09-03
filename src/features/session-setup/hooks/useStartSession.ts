import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { sessionService } from "@/lib/services/sessions";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import { useToast } from "@/shared/stores/toasts";
import type { PaymentRoute } from "@/shared/types";

export interface StartInput {
  moduleIds: string[];
  durationSeconds: number;
  provider: string;
  /* Which key pays, chosen on the setup screen. Left out and the server falls
     back to whatever the Key Vault implies. `mcp` is not offered — it is not
     a Candidate's route to pick. */
  paymentRoute?: PaymentRoute;
}

export function useStartSession() {
  const navigate = useNavigate();
  const remember = useSessionHistory((s) => s.remember);
  const toast = useToast();

  return useMutation({
    mutationFn: (input: StartInput) =>
      sessionService.start({
        module_ids: input.moduleIds,
        duration_seconds: input.durationSeconds,
        provider: input.provider,
        /* Null means "whatever my key situation implies" and is what a
           Candidate who never touched the picker sends. A named route is
           obeyed: the server refuses only `byok` with no key to spend. */
        payment_route: input.paymentRoute ?? null,
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
