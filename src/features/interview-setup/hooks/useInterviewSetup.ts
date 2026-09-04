import { useCallback, useEffect, useRef, useState } from "react";

import {
  acquire,
  canBegin,
  chooseEngine,
  forcedToType,
  requestMicrophone,
  setMode,
  setupSteps,
  useDictationStore,
} from "@/features/dictation";
import type { EngineId, MicOutcome, SetupProgress, StepState } from "@/features/dictation";
import { sessionService } from "@/lib/services/sessions";
import { useSessionUser } from "@/shared/stores/session";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import type { StartInput } from "@/features/session-setup";

/* The three checks, and the Session they are checks for (ISSUE-0053).
 *
 * All three run at once — they are independent, and running them in sequence
 * would add the slowest to the sum of the other two for no reason. The
 * *display* is sequential (`setupSteps`), which is a different thing: one
 * "now" at a time is what makes a stall legible.
 */

/** Whether `getUserMedia` needs a tap before it will do anything.
 *
 *  iOS Safari refuses the microphone outside a user gesture, and step 2 fires
 *  from an effect — so on iOS the check is a button and everywhere else it is
 *  automatic. Detected by platform because that is what the restriction is
 *  attached to: there is no capability to feature-detect, the call simply
 *  rejects, and a rejection is indistinguishable from a refusal. Getting it
 *  wrong the other way is worse — an automatic check on iOS spends the
 *  Candidate's one permission prompt on a call that was always going to fail.
 */
export function needsGesture(ua: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  /* iPadOS 13+ reports itself as a Mac and is only told apart by the
     touchscreen no Mac has. */
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

export interface SetupState {
  progress: SetupProgress;
  steps: [StepState, StepState, StepState];
  /** Whether Begin is enabled. A failed check enables it exactly as a passed
   *  one does — see `canBegin`. */
  ready: boolean;
  /** True once the Candidate will be typing, whatever they chose. */
  typing: boolean;
  sessionId: string | null;
  /** How many questions the fixed plan holds, when the response says. Null
   *  rather than a guess: the Questions fact is left out entirely rather than
   *  showing a number nothing returned. */
  questions: number | null;
  /** The API's own message, when the Session could not be started. The only
   *  fatal one: there is nothing to begin. */
  fatal: string | null;
  engine: EngineId | null;
  micOutcome: MicOutcome | null;
  /** Why speaking is unavailable, in the words it arrived in. */
  engineReason: string | null;
  /** Whether the microphone has been asked for yet. On the gesture platforms
   *  this stays false until the Candidate presses the button. */
  micAsked: boolean;
  /** Set when the microphone is a button rather than an effect. */
  gestureNeeded: boolean;
  checkMicrophone: () => void;
  /** Stamps the clock, and resolves true when it is stamped. Navigation is
   *  the screen's, not this hook's — a hook that navigates is doing two jobs,
   *  which is the thing this slice took out of `useStartSession`. */
  begin: () => Promise<boolean>;
  beginning: boolean;
  beginError: string | null;
}

export function useInterviewSetup(input: StartInput | null): SetupState {
  const candidateId = useSessionUser() ?? "anonymous";
  const remember = useSessionHistory((s) => s.remember);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<number | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [plan, setPlan] = useState<SetupProgress["plan"]>("pending");
  const [microphone, setMicrophone] = useState<SetupProgress["microphone"]>("pending");
  const [micOutcome, setMicOutcome] = useState<MicOutcome | null>(null);
  const [beginning, setBeginning] = useState(false);
  const [beginError, setBeginError] = useState<string | null>(null);

  const phase = useDictationStore((s) => s.phase);
  const engine = useDictationStore((s) => s.engine);
  const engineReason = useDictationStore((s) => s.reason);

  /* Lazy state rather than a ref: it is read during render, and a ref read
     during render is what `react-hooks/refs` forbids — correctly, since a ref
     that changed would not re-render the thing that read it. This one is a
     property of the browser and never changes, so state that is initialised
     once says that exactly. */
  const [gestureNeeded] = useState(() =>
    typeof navigator === "undefined"
      ? false
      : needsGesture(navigator.userAgent, navigator.maxTouchPoints ?? 0),
  );

  /* Load-bearing, not defensive. `POST /v1/sessions` is not idempotent — it
     fixes a plan and opens a Session that is paid for — and React StrictMode
     invokes every effect twice in development. Without this guard the
     Candidate gets two Sessions and sits the second one. Do not remove it in
     favour of a cleanup function: the request is already in flight by then. */
  const started = useRef(false);

  useEffect(() => {
    if (input === null || started.current) return;
    started.current = true;

    let live = true;
    sessionService
      .start({
        module_ids: input.moduleIds,
        duration_seconds: input.durationSeconds,
        provider: input.provider,
        payment_route: input.paymentRoute ?? null,
      })
      .then((data) => {
        if (!live) return;
        setSessionId(data.session_id);
        setQuestions(typeof data.question_count === "number" ? data.question_count : null);
        setPlan("done");
        /* Remembered here rather than in the mutation, because this is where
           the Session becomes a thing that exists. */
        remember({
          id: data.session_id,
          startedAt: Date.now(),
          moduleCount: input.moduleIds.length,
          durationSeconds: input.durationSeconds,
          state: "running",
        });
      })
      .catch((error: Error) => {
        if (!live) return;
        setPlan("fail");
        /* The API's own message. Composing one here is what would let a Credit
           message reach a BYOK Candidate. */
        setFatal(error.message);
      });

    return () => {
      live = false;
    };
  }, [input, remember]);

  /* Step 2. Asked for here so a permission sheet never lands on a running
     clock, and let go of immediately — `requestMicrophone` stops the track,
     because a stream held for a fifty-minute Session lights the operating
     system's recording indicator for fifty minutes. */
  const checkMicrophone = useCallback(() => {
    setMicrophone("pending");
    void requestMicrophone().then((outcome) => {
      setMicOutcome(outcome);
      setMicrophone(outcome === "granted" ? "done" : "fail");
    });
  }, []);

  const asked = useRef(false);
  useEffect(() => {
    if (gestureNeeded || asked.current) return;
    asked.current = true;
    checkMicrophone();
  }, [gestureNeeded, checkMicrophone]);

  /* Step 3. Independent of the Session — the model is a property of the
     browser — but keyed on it so a second Session in the same tab reuses what
     is already loaded rather than downloading again. */
  useEffect(() => {
    if (sessionId === null) return;
    void acquire(sessionId, candidateId);
  }, [sessionId, candidateId]);

  const engineStep: SetupProgress["engine"] =
    phase === "ready" || phase === "listening" || phase === "transcribing"
      ? "done"
      : phase === "unavailable"
        ? "fail"
        : "pending";

  const progress: SetupProgress = { plan, microphone, engine: engineStep };
  const typing = forcedToType(progress);

  /* Established before the clock starts rather than discovered by pressing a
     microphone that cannot work. */
  useEffect(() => {
    if (typing) setMode("type");
  }, [typing]);

  const begin = useCallback(async (): Promise<boolean> => {
    if (sessionId === null || beginning) return false;
    setBeginning(true);
    setBeginError(null);
    try {
      await sessionService.begin(sessionId);
      return true;
    } catch (error) {
      /* The Session still exists and is still theirs. Reported here rather
         than thrown, so a failed stamp is a message next to the button rather
         than a screen they cannot leave. */
      setBeginError((error as Error).message);
      return false;
    } finally {
      setBeginning(false);
    }
  }, [sessionId, beginning]);

  return {
    progress,
    steps: setupSteps(progress),
    ready: canBegin(progress),
    typing,
    sessionId,
    questions,
    fatal,
    engine: chooseEngine(candidateId) === null ? null : engine,
    micOutcome,
    engineReason,
    micAsked: microphone !== "pending" || !gestureNeeded,
    gestureNeeded,
    checkMicrophone,
    begin,
    beginning,
    beginError,
  };
}
