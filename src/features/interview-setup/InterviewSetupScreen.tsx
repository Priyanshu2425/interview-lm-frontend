import { useCallback } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useDictationStore } from "@/features/dictation";
import type { StartInput } from "@/features/session-setup";

import { useInterviewSetup } from "./hooks/useInterviewSetup";
import { SetupBody } from "./components/SetupBody";

/* The screen between Begin on `/session/new` and the first question
 * (ISSUE-0053).
 *
 * It exists because the model download used to happen in the composer, which
 * appears with the first question — so a Candidate spent the opening seconds
 * of a timed examination watching a progress bar. The clock now starts when
 * they say so, and the waiting happens here, before it.
 *
 * Outside `RootLayout` on purpose: a nav rail around a screen you are meant to
 * sit through is an invitation to leave it half-done, and here half-done is a
 * Session that is started, paid for and abandoned. Not lazy for the same kind
 * of reason — it is on the critical path of every Session, and a chunk fetch
 * would add a round-trip to the screen that exists to remove waiting.
 */
export function InterviewSetupScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const input = (location.state ?? null) as StartInput | null;

  const setup = useInterviewSetup(input);
  /* One selector per field. A selector returning a fresh object re-renders on
     every store write regardless of whether anything it reads changed, and
     during a download that is a write per progress event. */
  const progress = useDictationStore((s) => s.progress);
  const loaded = useDictationStore((s) => s.loaded);
  const total = useDictationStore((s) => s.total);
  const slow = useDictationStore((s) => s.slow);
  const device = useDictationStore((s) => s.device);

  const onBegin = useCallback(() => {
    void setup.begin().then((stamped) => {
      if (!stamped || setup.sessionId === null) return;
      /* `replace` so Back from the examination does not land on a setup screen
         whose Session has already begun. */
      navigate(`/examination/${setup.sessionId}`, { replace: true, viewTransition: true });
    });
  }, [setup, navigate]);

  const onCancel = useCallback(() => {
    navigate("/session/new", { replace: true });
  }, [navigate]);

  /* A reload loses `location.state`, and there is nothing to recover: before
     the Session exists nothing was lost, and after it exists it is the
     running-Session case `/session/new` already handles with
     `useLatestRunningSession`. Redirecting is the whole of the fix. */
  if (input === null) return <Navigate to="/session/new" replace />;

  return (
    <SetupBody
      steps={setup.steps}
      ready={setup.ready}
      typing={setup.typing}
      fatal={setup.fatal}
      engine={setup.engine}
      micOutcome={setup.micOutcome}
      engineReason={setup.engineReason}
      gestureNeeded={setup.gestureNeeded}
      micAsked={setup.micAsked}
      download={{ progress, loaded, total, slow, device }}
      facts={{
        questions: setup.questions,
        durationSeconds: input.durationSeconds,
        modules: input.moduleIds,
      }}
      sessionId={setup.sessionId}
      beginning={setup.beginning}
      beginError={setup.beginError}
      onCheckMicrophone={setup.checkMicrophone}
      onBegin={onBegin}
      onCancel={onCancel}
    />
  );
}
