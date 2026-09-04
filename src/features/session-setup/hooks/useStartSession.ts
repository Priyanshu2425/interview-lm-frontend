import { useNavigate } from "react-router-dom";
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

/* Hand the choices to `/session/setup`, which starts the Session (ISSUE-0053).
 *
 * This used to be a mutation that called `POST /v1/sessions`, remembered the
 * result and navigated. It no longer calls anything: the request fires on the
 * next screen, *in flight*, so the Candidate watches three checks tick rather
 * than a frozen form. Navigating after the response is what produced the frozen
 * form, and it is the behaviour ISSUE-0053 exists to remove.
 *
 * `remember()` moved with it, to where the Session becomes a thing that
 * exists. A hook that mutates, records and navigates is doing three jobs.
 */
export function useStartSession() {
  const navigate = useNavigate();

  return {
    /* Carried in `location.state` rather than in the URL: these are the
       Candidate's choices, not an address, and a scope of thirty module ids in
       a query string is a link somebody can share that starts a Session. */
    begin: (input: StartInput) =>
      navigate("/session/setup", { state: input, viewTransition: true }),
  };
}
