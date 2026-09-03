/* One microphone per browser tab, outliving every component that uses it.
 *
 * It is module state and not React state, and that is a constraint rather than
 * a preference. `ExaminationScreen` renders
 * `{composerDisabled ? null : <Composer/>}`, so the composer is unmounted and
 * remounted for **every single question** — a `Worker` in its state would
 * re-read 77MB from the Cache API and re-instantiate the ONNX session each
 * time, which is several seconds of hitch at the worst possible moment. The
 * engine also has to survive the navigation from `/session/setup`, which is a
 * different route subtree entirely.
 *
 * So: an imperative singleton here, `store.ts` as its reactive mirror, and
 * nothing outside this feature touching either.
 */

import { usePreferenceStore } from "@/shared/stores/preferences";

import { useDictationStore, resetDictation } from "./store";
import { armFor, hasWebSpeech, isSlow, throughput, type EngineId, type Sample } from "./helpers";
import { askForMicrophone } from "./capture";
import type { Recording, Transcriber } from "./transcriber";
import type { MicOutcome } from "./helpers";

/** Off, entirely.
 *
 *  A Session sat by a robot has no microphone and no reason to spend 77MB, and
 *  `tests/run.mjs` fails on a single console error the ONNX runtime may well
 *  produce. So the e2e suite seeds this and gets the typing path — which is
 *  the same path a refused microphone takes, and the one worth exercising in a
 *  headless run.
 *
 *  Not a test-only hook: it is also the switch somebody on a metered
 *  connection wants, and it should reach Settings. */
const OFF_KEY = "ilm.dictation.v1";

function switchedOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === "off";
  } catch {
    return false;
  }
}

const set = useDictationStore.setState;

let current: Transcriber | null = null;
let heldFor: string | null = null;
let preparing: Promise<void> | null = null;

/** Which arm, and why. A stated preference wins; otherwise it is decided from
 *  the Candidate's id so it holds steady across their Sessions, and capability
 *  gates it either way — Firefox has no speech service to be assigned to. */
export function chooseEngine(candidateId: string): EngineId | null {
  if (switchedOff()) return null;
  const available = hasWebSpeech(globalThis);
  const stated = usePreferenceStore.getState().prefs.dictationEngine;
  if (stated === "off") return null;
  if (stated === "whisper") return "whisper";
  if (stated === "webspeech") return available ? "webspeech" : "whisper";
  return armFor(candidateId, available);
}

async function build(engine: EngineId): Promise<Transcriber> {
  /* Imported on the way in, so neither engine's code is in the entry bundle
     and the transformers graph is only fetched by somebody about to speak. */
  if (engine === "webspeech") {
    const { webSpeechTranscriber } = await import("./webspeech/webspeech");
    return webSpeechTranscriber((text) => set({ interim: text }));
  }
  const { whisperTranscriber } = await import("./whisper/whisper");
  return whisperTranscriber();
}

/** Take the engine for this Session, and get it ready.
 *
 *  Idempotent on `sessionId`, which is what makes StrictMode's double effects
 *  and a remounting composer both harmless. Calling it for a *different*
 *  Session resets the per-Session state and keeps the loaded model: the
 *  download is a property of the browser, not of the Session. */
export function acquire(sessionId: string, candidateId: string): Promise<void> {
  if (heldFor === sessionId && preparing) return preparing;

  if (heldFor !== null && heldFor !== sessionId) {
    /* A second Session in the same tab. Only what belongs to the old one goes. */
    current?.cancel();
    resetDictation();
  }
  heldFor = sessionId;

  const engine = chooseEngine(candidateId);
  if (engine === null) {
    set({ phase: "unavailable", mode: "type", reason: "Speaking is switched off in this browser." });
    preparing = Promise.resolve();
    return preparing;
  }

  set({ phase: "preparing", engine, mode: "speak", progress: 0, reason: null });

  const startedAt = Date.now();
  const samples: Sample[] = [];

  preparing = (async () => {
    /* Reused where the model is already loaded — a second Session in the same
       tab must not download anything, and that is most of what "cached" means
       to a Candidate. */
    if (!current || current.id !== engine) {
      current?.dispose();
      current = await build(engine);
    }

    const outcome = await current.prepare(({ value, loaded, total }) => {
      const at = Date.now();
      samples.push({ at, loaded });
      const elapsed = at - startedAt;
      set({
        progress: value, loaded, total, elapsed,
        slow: isSlow(throughput(samples), elapsed),
      });
    });

    if (!outcome.ok) {
      set({ phase: "unavailable", mode: "type", reason: outcome.reason });
      return;
    }
    set({ phase: "ready", device: outcome.device, progress: 1, slow: false });
  })();

  return preparing;
}

/** Ask for the microphone without keeping it.
 *
 *  The setup screen's second check. Here rather than at the first question so
 *  the permission sheet never lands on a running clock — and it lets go
 *  immediately, because a stream held open for fifty minutes lights the
 *  operating system's recording indicator for fifty minutes. */
export async function requestMicrophone(): Promise<MicOutcome> {
  const outcome = await askForMicrophone();
  if (outcome !== "granted") set({ mode: "type" });
  return outcome;
}

export async function startListening(): Promise<MicOutcome> {
  if (!current) return "unsupported";
  set({ phase: "listening", interim: "", heard: null });
  const outcome = await current.start();
  if (outcome !== "granted") {
    set({ phase: "ready", mode: "type", interim: "" });
  }
  return outcome;
}

/** Stop, and hand back what was said.
 *
 *  Returns the whole `Recording` rather than a string, because "nothing was
 *  heard" is an outcome and not an error: the question is unchanged, nothing
 *  was sent, and the composer says which of the two silences it was. */
export async function stopListening(): Promise<Recording> {
  if (!current) return { heard: "silent", result: null };
  set({ phase: "transcribing" });
  const startedAt = Date.now();
  try {
    const recording = await current.stop();
    set({
      phase: "ready",
      heard: recording.heard,
      lastMs: Date.now() - startedAt,
      interim: "",
    });
    return recording;
  } catch (e) {
    /* Rendered from the message it arrived with, never composed here. */
    set({ phase: "ready", reason: String((e as Error).message ?? e), interim: "" });
    throw e;
  }
}

export function cancelListening(): void {
  current?.cancel();
  set({ phase: "ready", interim: "", heard: null });
}

export function attachMeter(bars: HTMLElement | null, halo: HTMLElement | null): void {
  current?.attachMeter(bars, halo);
}

export function setMode(mode: "speak" | "type"): void {
  set({ mode });
}

export function streamsWords(): boolean {
  return current?.streams ?? false;
}

/** Give the Session back.
 *
 *  The microphone and the meter go; the loaded model does not. Terminating the
 *  worker on the way out of an examination is what would make "it downloads
 *  once" false for anybody who sits two Sessions in one sitting. */
export function release(sessionId: string): void {
  if (heldFor !== sessionId) return;
  current?.cancel();
  heldFor = null;
  preparing = null;
}

/** The tab is going. Everything goes with it. */
export function shutdown(): void {
  current?.dispose();
  current = null;
  heldFor = null;
  preparing = null;
  resetDictation();
}
