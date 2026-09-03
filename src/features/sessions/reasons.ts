/* Why a Session stopped, in the Candidate's words.

   Only the endings are here. The three parking reasons arrive with the API's
   own `code` and `message`, and composing copy for them here is how a Credit
   message reaches a Candidate on their own key. */
export const ENDED: Record<string, string> = {
  duration: "Time was up",
  plan_exhausted: "The plan was run to the end",
  scope_exhausted: "Every Topic in scope was visited",
  candidate_ended: "You ended it",
};

export const endedAs = (reason: string | null): string =>
  (reason && ENDED[reason]) || (reason ? reason.replace(/_/g, " ") : "—");
