/* One way to ask for words, whoever is producing them.
 *
 * Two engines sit behind this: Whisper in a worker, and the browser's own
 * speech service. They are not variations on a theme — one downloads 77MB and
 * keeps the audio on the machine, the other downloads nothing and sends the
 * audio to Google or Apple — and the seam exists so a screen never has to know
 * which it got, while the Candidate always does.
 */

import type { Device, TranscriptionResult } from "./whisper/protocol";
import type { EngineId, Heard, MicOutcome } from "./helpers";

export type { EngineId, TranscriptionResult };

export interface Progress {
  /** 0..1, weighted by bytes. */
  value: number;
  /** Bytes so far and bytes expected, for the disclosure. Zero where the
   *  engine has nothing to download. */
  loaded: number;
  total: number;
}

export type PrepareOutcome =
  | { ok: true; device: Device | null }
  | { ok: false; reason: string };

/** What a recording turned out to be.
 *
 *  `silent` and `too-short` never reach the model: there is no Answer Turn to
 *  send, and sending one would submit whatever Whisper invents from silence. */
export interface Recording {
  heard: Heard;
  result: TranscriptionResult | null;
}

export interface Transcriber {
  readonly id: EngineId;

  /** Get ready. For Whisper this is the download; for the browser's service it
   *  is a capability check that answers immediately. */
  prepare(onProgress: (p: Progress) => void): Promise<PrepareOutcome>;

  /** Open the microphone and begin. Rejects with a `MicOutcome` reason if the
   *  device cannot be had. */
  start(): Promise<MicOutcome>;

  /** Stop, and produce what was said. Closes the microphone either way — the
   *  operating system's recording light must go out when the Candidate thinks
   *  it has. */
  stop(): Promise<Recording>;

  /** Give up on whatever is in flight. Neither engine can truly interrupt a
   *  decode in progress; this abandons the answer rather than pretending to
   *  cancel the work. */
  cancel(): void;

  /** Live bar heights and the halo, written straight to the DOM. Null before
   *  a recording starts. */
  attachMeter(bars: HTMLElement | null, halo: HTMLElement | null): void;

  /** Interim words, where the engine produces them. Whisper does not — it
   *  hears the whole answer at once — and a screen that offers a live
   *  transcript in one arm and not the other should say so rather than
   *  pretend both behave alike. */
  readonly streams: boolean;

  /** Which runtime ran, once known. */
  device(): Device | null;

  dispose(): void;
}
