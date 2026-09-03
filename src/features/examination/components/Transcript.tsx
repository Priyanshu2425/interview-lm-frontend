import { memo } from "react";
import type { Turn, TurnRole } from "../hooks/useExamination";
import { Thinking } from "@/ui";

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
  turns: Turn[];
  thinking: boolean;
  resumedMidQuestion: boolean;
}

/* One stream, in the order things happened.
   Nothing is graded while a Session runs (ISSUE-0042), so there is no score to
   place between two turns and no closed-Visit event to interleave. */
export function Transcript({ turns, thinking, resumedMidQuestion }: TranscriptProps) {
  return (
    <div aria-live="polite" aria-relevant="additions">
      {/* Only when the transcript could not be read back. When it can, the
          earlier turns are simply here and there is nothing to explain. */}
      {resumedMidQuestion ? (
        <p className="caption hair-b" style={{ paddingBottom: "var(--s-5)" }}>
          Picked up mid-question. The earlier turns are on the record — this screen
          could not read them back, and the Judge sees the whole exchange whether or
          not it is shown here.
        </p>
      ) : null}

      {turns.map((turn) => <TurnRow key={turn.id} turn={turn} />)}

      {thinking ? (
        <div className="turn turn--examiner">
          <span className="turn-role">Examiner</span>
          <div className="turn-body"><Thinking label="The examiner is composing a follow-up" /></div>
        </div>
      ) : null}
    </div>
  );
}
