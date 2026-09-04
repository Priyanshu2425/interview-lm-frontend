import type { Ref } from "react";
import { setMode, useDictationStore } from "@/features/dictation";

import { Composer } from "./Composer";
import { VoiceComposer } from "./VoiceComposer";

/* Which composer the Candidate gets (ISSUE-0054).
 *
 * The whole of the decision, and it is one line: the mode lives in the
 * dictation store because it has to survive this component unmounting, which
 * it does for every single question. It is set to `type` by a failed setup
 * (ISSUE-0053), by the Candidate choosing, and by a microphone that is refused
 * mid-Session.
 *
 * `Composer` is untouched by this slice and is the fallback for all three of
 * those. That it is unmodified is the review checkpoint for the slice —
 * everything here rests on the typing path still being exactly what it was.
 */

interface AnswerComposerProps {
  disabled: boolean;
  sending: boolean;
  onSubmit: (answer: string, spoken?: boolean) => void;
  error: string | null;
  onRetry: () => void;
  footRef?: Ref<HTMLDivElement>;
}

export function AnswerComposer(props: AnswerComposerProps) {
  const mode = useDictationStore((s) => s.mode);
  const phase = useDictationStore((s) => s.phase);

  /* `cold` means nothing ever acquired an engine — a Session resumed straight
     into `/examination/:id` without passing through `/session/setup`. There is
     no download in progress to wait for and none will start, so the honest
     screen is the typing one rather than a progress bar that never moves. */
  if (mode !== "type" && phase !== "cold") return <VoiceComposer {...props} />;

  /* The way back to speaking, and it is here rather than inside `Composer`
     because `Composer` does not change in this slice. Offered only where it
     can work: with no engine there is nothing to switch to, and a control that
     reaches nothing is the thing AGENTS.md refuses. */
  const canSpeak = phase !== "unavailable" && phase !== "cold";

  return (
    <>
      <Composer {...props} />
      {canSpeak ? (
        <div className="hint-row">
          <span className="modes" role="group" aria-label="How you answer">
            <button
              type="button"
              aria-pressed={false}
              data-mode="speak"
              onClick={() => setMode("speak")}
            >
              Speak
            </button>
            <button type="button" aria-pressed={true} data-mode="type">Type</button>
          </span>
        </div>
      ) : null}
    </>
  );
}
