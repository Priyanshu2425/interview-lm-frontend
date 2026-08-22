import type { SessionEnded, SessionParked } from "@/shared/types";
import { Button, ButtonLink, Icon, Panel } from "@/ui";

const REASON_COPY: Record<string, { title: string; body: string }> = {
  duration: {
    title: "Time was up, and the Visit finished anyway",
    body: "The deadline passed during the last Topic, so the Session ran it to the end and scored it. Nothing was discarded.",
  },
  candidate_ended: {
    title: "You ended the Session",
    body: "The Topic in progress was examined to the end first. Everything it produced is on the record.",
  },
  scope_exhausted: {
    title: "Every Topic in scope has been visited",
    body: "Widen the scope, or come back to the thin evidence when there is more of it.",
  },
};

export function SessionEndedNotice({ ended, sessionId }: { ended: SessionEnded; sessionId: string }) {
  const copy = REASON_COPY[ended.reason] ?? {
    title: "The Session ended",
    body: `Reason recorded as ${ended.reason}.`,
  };
  return (
    <Panel pad={7} className="stack g-6 outcome">
      <span className="eyebrow">Session closed</span>
      <h2 className="h2">{copy.title}</h2>
      <p className="prose" style={{ margin: 0 }}>{copy.body}</p>
      <div className="row g-4" style={{ flexWrap: "wrap" }}>
        <ButtonLink to={`/evidence/${sessionId}`} variant="primary">See what it recorded</ButtonLink>
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
