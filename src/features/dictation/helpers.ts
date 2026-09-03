/* The parts of dictation that are just arithmetic on values.
 *
 * Everything here is pure and exported, which is the shape this repo tests:
 * a worker, a `MediaStream` and an `AudioContext` are all things jsdom does
 * not have, and a stub of one is a lie about coverage. So the judgement calls
 * live here — how far along a download is, whether a connection is slow,
 * whether anybody actually said anything — and the modules that own the
 * hardware do as little deciding as possible.
 */

import type { Device } from "./whisper/protocol";

/* -- the download ---------------------------------------------------------- */

export interface FileProgress {
  loaded: number;
  total: number;
}

/** How far along, weighted by bytes rather than by file.
 *
 *  The model is four files that differ in size by more than 20×. Averaging
 *  their percentages would have the tokenizer finishing instantly and the bar
 *  sitting at 25% for the whole of the real download, which is the exact
 *  behaviour a progress bar exists to avoid. */
export function progressOf(files: Record<string, FileProgress>): number {
  let loaded = 0;
  let total = 0;
  for (const f of Object.values(files)) {
    /* A file whose size is not yet known contributes nothing rather than
       dividing by zero — it appears as soon as the server says how big it is. */
    if (!f.total || f.total <= 0) continue;
    total += f.total;
    loaded += Math.min(f.loaded, f.total);
  }
  if (total <= 0) return 0;
  return Math.min(1, loaded / total);
}

export interface Sample {
  at: number;
  loaded: number;
}

/** Bytes per second over the trailing window, or null while there is not
 *  enough to say. Two samples is the minimum that describes a rate at all. */
export function throughput(samples: Sample[], windowMs = 5000): number | null {
  if (samples.length < 2) return null;
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last.at - s.at <= windowMs) ?? samples[0];
  const seconds = (last.at - first.at) / 1000;
  if (seconds <= 0) return null;
  return Math.max(0, (last.loaded - first.loaded) / seconds);
}

/** Below this, a download is slow enough to be worth naming. */
export const SLOW_BYTES_PER_SECOND = 250 * 1024;
/** Before this, nothing is slow: every download starts at zero. */
export const SLOW_AFTER_MS = 6000;
/** And after this, it does not matter what the number says.
 *
 *  The Session is open from `POST /sessions`, so waiting past here is a
 *  Candidate deciding to wait rather than one who has not been told they can
 *  stop (ISSUE-0053). */
export const IMPATIENT_AFTER_MS = 45_000;

export function isSlow(bytesPerSecond: number | null, elapsedMs: number): boolean {
  if (elapsedMs >= IMPATIENT_AFTER_MS) return true;
  if (elapsedMs < SLOW_AFTER_MS) return false;
  if (bytesPerSecond === null) return false;
  return bytesPerSecond < SLOW_BYTES_PER_SECOND;
}

/* -- the level meter ------------------------------------------------------- */

/** Bar heights in 0..1 from one `getByteTimeDomainData` frame.
 *
 *  Silence is 128 on that scale, so an untouched buffer produces zeros and the
 *  bars sit flat — which is the point. A meter that idles at a lively wobble
 *  says "we can hear you" to somebody whose microphone is muted at the
 *  operating system, and they find out a minute later. */
export function levelBars(frame: Uint8Array, count: number): number[] {
  const out = new Array<number>(count).fill(0);
  if (frame.length === 0 || count <= 0) return out;
  const per = Math.max(1, Math.floor(frame.length / count));
  for (let b = 0; b < count; b++) {
    let peak = 0;
    const start = b * per;
    const end = Math.min(frame.length, start + per);
    for (let i = start; i < end; i++) {
      const v = Math.abs(frame[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    /* Amplitude is not loudness. A square root opens up the quiet end, which
       is where ordinary speech lives — linear bars read as near-silent for
       anybody not shouting. */
    out[b] = Math.min(1, Math.sqrt(peak));
  }
  return out;
}

/** Loudest sample in a frame, 0..1. */
export function peakOf(frame: Uint8Array): number {
  let peak = 0;
  for (let i = 0; i < frame.length; i++) {
    const v = Math.abs(frame[i] - 128) / 128;
    if (v > peak) peak = v;
  }
  return peak;
}

/** Under this, nothing reached the microphone at all. */
export const SILENCE_PEAK = 0.02;
/** And under this, there is not enough audio to transcribe: Whisper's chunking
 *  degenerates on a fragment and it starts inventing sentences. */
export const TOO_SHORT_MS = 400;

export type Heard = "speech" | "silent" | "too-short";

export function whatWasHeard(peak: number, durationMs: number): Heard {
  if (durationMs < TOO_SHORT_MS) return "too-short";
  if (peak < SILENCE_PEAK) return "silent";
  return "speech";
}

/** What Whisper says when it is given a room and no speech.
 *
 *  This is a real and well-known failure mode rather than a hypothetical: fed
 *  near-silence the model emits a confident short sentence from its training
 *  distribution. Unhandled, a Candidate who pressed the button by accident
 *  submits "Thank you." as an Answer Turn and is graded on it. */
const HALLUCINATED_SILENCE = new Set([
  "thank you", "thanks", "thank you.", "you", "bye", "bye.", "okay", "ok",
  "[blank_audio]", "(blank_audio)", "[silence]", "[music]", "[blank _audio]",
  ".", "..", "...", "-", "the",
]);

/** Whether a transcript is the model talking to itself.
 *
 *  Deliberately not a quality judgement — nothing here asks whether an answer
 *  is any good, which is the Judge's job and not the surface's. It asks
 *  whether an Answer Turn exists to send at all. */
export function looksLikeSilence(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length === 0) return true;
  if (HALLUCINATED_SILENCE.has(t)) return true;
  /* Two words or fewer, and nothing but punctuation and filler. A real answer
     to an examination question is never this short. */
  return t.replace(/[^a-z0-9]/g, "").length < 3;
}

/* -- the microphone -------------------------------------------------------- */

export type MicOutcome = "granted" | "denied" | "no-device" | "unsupported";

/** What a `getUserMedia` rejection actually means.
 *
 *  The three are different facts and the screen says different things about
 *  them: a refusal can be undone in the address bar, a missing device cannot,
 *  and an insecure context is our deployment's problem rather than theirs. */
export function micOutcome(error: unknown): MicOutcome {
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-device";
  return "unsupported";
}

/* -- the setup screen's three checks --------------------------------------- */

export type StepState = "wait" | "now" | "done" | "fail";

export interface SetupProgress {
  plan: "pending" | "done" | "fail";
  microphone: "pending" | "done" | "fail";
  engine: "pending" | "done" | "fail";
}

/** The three checks, as the screen draws them.
 *
 *  They run in parallel — they are three independent things — but only one is
 *  ever "now", and it is the first unsettled one. That is what makes a stalled
 *  download read as `1✓ 2✓ 3⟳` rather than as three spinners saying nothing. */
export function setupSteps(p: SetupProgress): [StepState, StepState, StepState] {
  const order: Array<SetupProgress[keyof SetupProgress]> = [
    p.plan, p.microphone, p.engine,
  ];
  const firstPending = order.findIndex((s) => s === "pending");
  return order.map((s, i) => {
    if (s === "done") return "done";
    if (s === "fail") return "fail";
    return i === firstPending ? "now" : "wait";
  }) as [StepState, StepState, StepState];
}

/** Whether the Candidate may begin.
 *
 *  A failed step enables Begin exactly as a finished one does. That is the
 *  rule from ISSUE-0049 — *setup is never the reason somebody cannot sit their
 *  interview* — expressed as an expression rather than as a sentence in a
 *  document, because a sentence drifts and this cannot.
 *
 *  The plan is the one exception, and not as a policy: a Session that failed
 *  to start does not exist, so there is nothing to begin. */
export function canBegin(p: SetupProgress): boolean {
  if (p.plan !== "done") return false;
  return p.microphone !== "pending" && p.engine !== "pending";
}

/** Whether answers will be typed rather than spoken.
 *
 *  Decided here, once, and carried into the composer — so the fallback is a
 *  fact established before the clock starts rather than something the
 *  Candidate discovers by pressing a microphone that cannot work. */
export function forcedToType(p: SetupProgress): boolean {
  return p.microphone === "fail" || p.engine === "fail";
}

/* -- which arm ------------------------------------------------------------- */

export type EngineId = "whisper" | "webspeech";

/** Whether Web Speech exists here at all.
 *
 *  Firefox has no `SpeechRecognition` of any kind, so a third of desktop can
 *  never be in that arm. A comparison that quietly excluded them would still
 *  be a comparison, but not of what it claimed. */
export function hasWebSpeech(w: unknown): boolean {
  const g = w as Record<string, unknown> | null;
  if (!g) return false;
  return typeof g.SpeechRecognition === "function"
    || typeof g.webkitSpeechRecognition === "function";
}

/** Which arm this Candidate gets, held steady across their Sessions.
 *
 *  Deterministic on the id rather than random per visit: somebody who is asked
 *  which of two experiences was better needs to have had one of them, not a
 *  coin flip per question. A stated preference always wins — this decides only
 *  where nobody has chosen.
 *
 *  Nothing here reports anything. Collecting the comparison is a later slice;
 *  this is the seam it will need. */
export function armFor(candidateId: string, webSpeechAvailable: boolean): EngineId {
  if (!webSpeechAvailable) return "whisper";
  let hash = 0;
  for (let i = 0; i < candidateId.length; i++) {
    hash = (hash * 31 + candidateId.charCodeAt(i)) | 0;
  }
  return (hash & 1) === 0 ? "whisper" : "webspeech";
}

/** What a Candidate must be told about where their voice goes.
 *
 *  Not decoration. Whisper runs in the browser and the audio never leaves it.
 *  The Web Speech API sends audio to the browser's vendor — Google on Chrome,
 *  Apple on Safari — and a screen that claimed otherwise in that arm would be
 *  lying about a microphone in an examination. */
export function privacyOf(engine: EngineId): "on-device" | "sent-to-vendor" {
  return engine === "whisper" ? "on-device" : "sent-to-vendor";
}

export function privacyLine(engine: EngineId): string {
  return engine === "whisper"
    ? "Your voice never leaves this browser. Only the text is sent, and only when you send it."
    : "Your browser sends what you say to its own speech service to be written down. Only the text reaches us.";
}

export function engineLabel(engine: EngineId, device: Device | null): string {
  if (engine === "webspeech") return "Browser speech";
  return device === "webgpu" ? "WebGPU" : "CPU";
}
