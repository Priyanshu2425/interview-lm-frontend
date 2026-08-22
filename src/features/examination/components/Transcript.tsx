import { memo } from "react";
import type { PaymentRoute, Spend } from "@/shared/types";
import type { TranscriptEntry, Turn, TurnRole } from "../hooks/useExamination";
import { Thinking } from "@/ui";
import { VisitResult } from "./VisitResult";

const ROLE_LABEL: Record<TurnRole, string> = {
  examiner: "Examiner",
  you: "You",
  probe: "Probe",
  hint: "Hint",
};

/* Memoised on the entry itself: appending an answer must not re-render the
   twelve turns already on screen. */
const TurnRow = memo(function TurnRow({ turn }: { turn: Turn }) {
  return (
    <article className={`turn turn--${turn.role}`}>
      <span className="turn-role">{ROLE_LABEL[turn.role]}</span>
      <div className="turn-body">{turn.text}</div>
    </article>
  );
});

interface TranscriptProps {
  entries: TranscriptEntry[];
  thinking: boolean;
  resumedMidVisit: boolean;
  route: PaymentRoute;
  spend: Spend | undefined;
  ended: boolean;
}

/* One stream, in the order things happened: the exchange, then the score the
   Visit produced, then the question that opens the next one. */
export function Transcript({ entries, thinking, resumedMidVisit, route, spend, ended }: TranscriptProps) {
  return (
    <div aria-live="polite" aria-relevant="additions">
      {resumedMidVisit ? (
        <p className="caption hair-b" style={{ paddingBottom: "var(--s-5)" }}>
          Picked up mid-Visit. The earlier turns are on the record — the surface is not served them back,
          and the Judge sees the whole exchange whether or not it is on this screen.
        </p>
      ) : null}

      {entries.map((entry) =>
        entry.type === "turn" ? (
          <TurnRow key={entry.id} turn={entry} />
        ) : (
          <div className="mt-8" key={entry.id}>
            <VisitResult
              visit={entry.visit}
              route={route}
              credits={
                spend?.per_visit.find((v) => v.topic_visit_id === entry.visit.topic_visit_id)?.credits ?? null
              }
              ended={ended}
            />
          </div>
        ),
      )}

      {thinking ? (
        <div className="turn turn--examiner">
          <span className="turn-role">Examiner</span>
          <div className="turn-body"><Thinking label="The examiner is composing a follow-up" /></div>
        </div>
      ) : null}
    </div>
  );
}
