import type { SessionEnded, SessionParked } from "@/shared/types";
import { Button, ButtonLink, Icon, Panel } from "@/ui";
import { endReason } from "@/shared/utils/reasons";

export function SessionEndedNotice({ ended, sessionId, graded }: {
  ended: SessionEnded;
  sessionId: string;
  /** How many Topics the ending graded. Null where the Session ended on its
   *  own edge rather than through `/end` — the report is the authority on
   *  what was measured either way, so no number is invented here. */
  graded?: number | null;
}) {
  const copy = endReason(ended.reason);
  return (
    <Panel pad={7} className="stack g-6 outcome">
      <span className="eyebrow">Session closed</span>
      <h2 className="h2">{copy.title}</h2>
      <p className="prose" style={{ margin: 0 }}>{copy.body}</p>
      {/* Grading happens once, here, and this is the only place that says so
          before the report is opened. A count of Topics measured is not a
          score and is not a reading — it is how many rows were written. */}
      <p className="body-sm dim" style={{ margin: 0 }}>
        {typeof graded === "number"
          ? `Graded now, in one pass: ${graded} Topic${graded === 1 ? "" : "s"} measured from what was said. Anything the plan never reached was left unasked.`
          : "The whole Session was graded in one pass, from what was actually said. Anything the plan never reached was left unasked."}
      </p>
      <div className="row g-4" style={{ flexWrap: "wrap" }}>
        <ButtonLink to={`/report/${sessionId}`} variant="primary">Read the report</ButtonLink>
        <ButtonLink to="/mastery" variant="secondary">Mastery map</ButtonLink>
        <ButtonLink to="/session/new" variant="ghost">Start another</ButtonLink>
      </div>
    </Panel>
  );
}

/* A Provider failure parks rather than fails over: switching graders mid-Visit
   would split one score across two of them and corrupt the provenance record.
   The message is the API's own — the surface composes no billing copy, which
   is what keeps a Credit message from reaching a BYOK Candidate. */
export function SessionParkedNotice({ parked, onResume, resuming }: {
  parked: SessionParked;
  onResume: () => void;
  resuming: boolean;
}) {
  return (
    <Panel pad={7} className="stack g-6 outcome" role="alert">
      <span className="row g-4">
        <Icon name="resume" size={18} style={{ color: "var(--warn)" }} />
        <span className="eyebrow">Parked · {parked.code}</span>
      </span>
      <h2 className="h2">This Session is waiting, not lost</h2>
      <p className="prose" style={{ margin: 0 }}>{parked.message}</p>
      {/* Waiting is not over, and only a Session that is over is graded.
          Saying so here is what stops a parked Session reading as a result
          with the numbers missing. */}
      <p className="body-sm dim" style={{ margin: 0 }}>
        It has not been graded. Nothing is measured until the Session finishes, so
        resuming carries on rather than starting again.
      </p>
      {parked.provider ? (
        <p className="caption" style={{ margin: 0 }}>Provider: {parked.provider}</p>
      ) : null}
      <div className="row g-4" style={{ flexWrap: "wrap" }}>
        {parked.recoverable ? (
          <Button variant="primary" onClick={onResume} loading={resuming} loadingLabel="Resuming…">
            Resume the Session
          </Button>
        ) : null}
        <ButtonLink to="/credits" variant="secondary">Check the ledger</ButtonLink>
      </div>
    </Panel>
  );
}
