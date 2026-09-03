import { create } from "zustand";

import type { Device } from "./whisper/protocol";
import type { EngineId, Heard } from "./helpers";

/* What a screen is allowed to know about the microphone.
 *
 * The engine itself is a module singleton (`engine.ts`) rather than state,
 * because it has to outlive the composer — `ExaminationScreen` unmounts and
 * remounts that for every question, and a `Worker` held in a component's state
 * would re-download 77MB each time. This store is the part React may watch.
 */

export type DictationPhase =
  | "cold"        // nothing asked for yet
  | "preparing"   // downloading, or checking what this browser can do
  | "ready"
  | "listening"
  | "transcribing"
  | "unavailable";

export type AnswerMode = "speak" | "type";

export interface DictationState {
  phase: DictationPhase;
  /** Which arm this Candidate is in, and therefore where their voice goes. */
  engine: EngineId;
  device: Device | null;
  /** 0..1 while preparing. */
  progress: number;
  loaded: number;
  total: number;
  /** Milliseconds since the download began, so slowness can be judged. */
  elapsed: number;
  slow: boolean;
  /** The reason the engine is unavailable, in the words it arrived in. */
  reason: string | null;
  /** How the Candidate is answering. Set to `type` by a failed setup and by
   *  the Candidate choosing; it survives the composer's unmount because it
   *  lives here. */
  mode: AnswerMode;
  /** Live words, on the arm that produces them. */
  interim: string;
  /** What the last recording turned out to be, so the composer can say which
   *  of the two silences it was. */
  heard: Heard | null;
  /** How long the last transcription took. Reported so the copy that says "a
   *  few seconds" can be held to it. */
  lastMs: number | null;
}

const INITIAL: DictationState = {
  phase: "cold",
  engine: "whisper",
  device: null,
  progress: 0,
  loaded: 0,
  total: 0,
  elapsed: 0,
  slow: false,
  reason: null,
  mode: "speak",
  interim: "",
  heard: null,
  lastMs: null,
};

/* Written to by `engine.ts` with `setState`, which is legal outside React and
   is what lets a module singleton drive a component tree without either one
   holding the other. */
export const useDictationStore = create<DictationState>(() => INITIAL);

export const resetDictation = () => useDictationStore.setState(INITIAL, true);
