/* Answering out loud (ISSUE-0049).
 *
 * A feature of its own rather than a folder under `examination/`, and for a
 * reason worth writing down: `session-start` needs the engine warm before the
 * clock starts, `examination` needs it while a question is open, and
 * `eslint.config.js` forbids `@/features/<name>/<file>`. Two features can only meet
 * through a barrel — so this is the barrel, and everything behind it is
 * private.
 *
 * ISSUE-0049 proposed `features/examination/hooks/useDictation.ts`. That would
 * have made the setup screen import the screen it precedes.
 */

export {
  acquire,
  release,
  shutdown,
  requestMicrophone,
  startListening,
  stopListening,
  cancelListening,
  attachMeter,
  setMode,
  streamsWords,
  chooseEngine,
} from "./engine";

export { useDictationStore } from "./store";
export type { AnswerMode, DictationPhase, DictationState } from "./store";

export {
  canBegin,
  engineLabel,
  forcedToType,
  looksLikeSilence,
  privacyLine,
  privacyOf,
  setupSteps,
} from "./helpers";
export type {
  EngineId, Heard, MicOutcome, SetupProgress, StepState,
} from "./helpers";

export type { Recording, TranscriptionResult } from "./transcriber";

/* Which backend the model ended up on. Exported because `engineLabel` takes
   one and the setup screen has to render what it returns. */
export type { Device } from "./whisper/protocol";
