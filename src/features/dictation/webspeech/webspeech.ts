/* The browser's own speech service.
 *
 * Nothing to download and nothing to warm up, and it is usually better at
 * proper nouns than a 77MB model can be — because it is not a 77MB model. It
 * is a datacentre.
 *
 * Which is the thing about it. `SpeechRecognition` in Chrome streams audio to
 * Google, and in Safari to Apple. The Candidate's voice leaves their machine
 * on this arm, and every screen that carries a privacy line must say so
 * (`privacyLine` in `../helpers`). A comparison between the two engines that
 * hid this would be comparing accuracy and quietly trading something else.
 *
 * Firefox has no implementation at all, so a third of desktop is never in this
 * arm — `hasWebSpeech` gates it, and `armFor` never assigns it blind.
 */

import type { Progress, PrepareOutcome, Recording, Transcriber } from "../transcriber";
import { looksLikeSilence, micOutcome, type MicOutcome } from "../helpers";
import { meterFor, openMicrophone, type Meter } from "../capture";

/* The API is not in TypeScript's DOM library, and pulling in a package of
   ambient declarations for four members would be a dependency for a type. */
interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { readonly length: number;[index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function ctor(): SpeechRecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  const found = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return typeof found === "function" ? (found as SpeechRecognitionCtor) : null;
}

export function webSpeechTranscriber(
  onInterim?: (text: string) => void,
): Transcriber {
  let recognition: SpeechRecognitionLike | null = null;
  let stream: MediaStream | null = null;
  let meter: Meter | null = null;
  let bars: HTMLElement | null = null;
  let halo: HTMLElement | null = null;

  let settled = "";
  let interim = "";
  let failure: string | null = null;
  let ended: (() => void) | null = null;

  function release() {
    meter?.stop();
    meter = null;
    for (const t of stream?.getTracks() ?? []) t.stop();
    stream = null;
  }

  return {
    id: "webspeech",
    /* It produces words while the Candidate is still speaking, and the
       composer shows them. Whisper cannot, and the two arms look different
       because they are. */
    streams: true,

    /* No runtime to choose. The work happens somewhere we cannot see. */
    device: () => null,

    async prepare(onProgress: (p: Progress) => void): Promise<PrepareOutcome> {
      onProgress({ value: 1, loaded: 0, total: 0 });
      if (!ctor()) {
        return { ok: false, reason: "This browser has no speech recognition of its own." };
      }
      return { ok: true, device: null };
    },

    async start(): Promise<MicOutcome> {
      const Recognition = ctor();
      if (!Recognition) return "unsupported";

      /* Opened for the meter only. `SpeechRecognition` takes the microphone
         itself and gives us nothing to measure, and a recording indicator with
         no bars beside it is the one thing the level meter exists to prevent. */
      try {
        stream = await openMicrophone();
      } catch (e) {
        return micOutcome(e);
      }
      meter = meterFor(stream);
      meter.attach(bars, halo);

      settled = "";
      interim = "";
      failure = null;

      const r = new Recognition();
      recognition = r;
      r.continuous = true;
      r.interimResults = true;
      r.lang = "en-US";

      r.onresult = (event) => {
        interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? "";
          if (result.isFinal) settled += text;
          else interim += text;
        }
        onInterim?.((settled + interim).trim());
      };
      r.onerror = (e) => {
        /* `no-speech` and `aborted` are outcomes rather than faults: the first
           is answered by the silence check below, the second is the Candidate
           pressing stop. */
        if (e.error !== "no-speech" && e.error !== "aborted") failure = e.error;
      };
      r.onend = () => { ended?.(); };

      r.start();
      return "granted";
    },

    async stop(): Promise<Recording> {
      const r = recognition;
      if (!r) return { heard: "silent", result: null };

      await new Promise<void>((resolve) => {
        ended = () => resolve();
        try { r.stop(); } catch { resolve(); }
        /* Some builds never fire `onend` after a `stop` with nothing heard.
           Waiting forever would leave the composer transcribing for the rest
           of the Session. */
        window.setTimeout(resolve, 1500);
      });
      ended = null;
      recognition = null;
      release();

      const text = (settled + interim).trim();
      if (failure) throw new Error(`The speech service refused: ${failure}.`);
      /* The same check the other arm runs, for the same reason: an Answer Turn
         has to exist before it can be sent. */
      if (looksLikeSilence(text)) return { heard: "silent", result: null };
      return { heard: "speech", result: { text, marks: [] } };
    },

    cancel() {
      try { recognition?.abort(); } catch { /* already gone */ }
      recognition = null;
      ended = null;
      release();
    },

    attachMeter(nextBars, nextHalo) {
      bars = nextBars;
      halo = nextHalo;
      meter?.attach(nextBars, nextHalo);
    },

    dispose() {
      this.cancel();
    },
  };
}
