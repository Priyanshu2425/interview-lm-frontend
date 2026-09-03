/* Why a Session stopped, in the Candidate's words.

   The keys are `EndReason` on the server, and the split matters: a Session
   that *ended* is graded, and a Session that *parked* is waiting. Topping up
   Credits resumes a parked Session, so grading it would write a Beta
   observation for a Candidate about to be asked more about the same Topics.

   The three parking reasons are absent on purpose. Those arrive with the API's
   own `code` and `message`, and composing copy for them here is how a Credit
   message reaches a Candidate on their own key. */
export interface Reason {
  title: string;
  body: string;
}

export const END_REASON: Record<string, Reason> = {
  duration: {
    title: "Time was up, and the question finished anyway",
    body: "The deadline passed while a question was being asked, so it was examined to the end. Nothing was discarded.",
  },
  candidate_ended: {
    title: "You ended the Session",
    body: "The question in progress was examined to the end first. Everything that was said is on the record.",
  },
  plan_exhausted: {
    title: "Every question in the plan has been asked",
    body: "The plan was fixed before the first question and it has been run to the end.",
  },
  scope_exhausted: {
    title: "Every Topic in scope has been visited",
    body: "Widen the scope, or come back to the thin evidence when there is more of it.",
  },
};

export const endReason = (reason: string | null | undefined): Reason =>
  (reason && END_REASON[reason]) || {
    title: "The Session ended",
    body: reason ? `Reason recorded as ${reason}.` : "It is closed and on the record.",
  };
