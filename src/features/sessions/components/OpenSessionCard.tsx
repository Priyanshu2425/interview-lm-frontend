import { ButtonLink } from "@/ui";
import { duration as fmtDuration, relativeTime } from "@/shared/utils/format";
import type { SessionListing } from "@/shared/types";
import { PlanDots } from "./PlanDots";

/* The one Session you can act on, lifted out of the record.
 *
 * Running and parked both resume, and they are not the same fact. A parked
 * Session is waiting rather than finished, so it has not been graded — saying
 * so here is what stops "no numbers" reading as "did badly". */
export function OpenSessionCard({ session, scope }: {
  session: SessionListing;
  scope: string;
}) {
  const parked = session.state === "parked";
  return (
    <div className="open-card">
      <div className="between" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <span className="eyebrow">{parked ? "Parked" : "Still open"}</span>
          <h2 className="h2 mt-3">{scope}</h2>
          <p className="caption mt-4">
            {session.started_at ? `Started ${relativeTime(session.started_at)}` : "Started"}
            {" · "}
            {fmtDuration(session.duration_seconds)}
            {session.budget_questions
              ? ` · ${session.questions_asked} of ${session.budget_questions} questions asked`
              : ""}
          </p>
          <p className="caption mt-3">
            {parked
              ? "It has not been graded — a Session that is waiting is not finished. Resuming carries it on."
              : "It resumes exactly where it stopped."}
          </p>
        </div>
        <ButtonLink to={`/examination/${session.session_id}`} variant="primary">
          Resume
        </ButtonLink>
      </div>
      {session.budget_questions ? (
        <PlanDots asked={session.questions_asked} budget={session.budget_questions} />
      ) : null}
    </div>
  );
}
