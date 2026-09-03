/* The microphone: getting it, metering it, and letting go of it.
 *
 * Everything that needs a `MediaStream` is here, so the transcribers can be
 * about transcribing and the helpers can stay pure.
 */

import { levelBars, micOutcome, peakOf, type MicOutcome } from "./helpers";

/** Asks for the microphone and immediately gives it back.
 *
 *  Used by the setup screen. Asking here means the permission sheet lands
 *  before the clock starts rather than on top of a running one — and letting
 *  go means the operating system's recording indicator is not lit for the
 *  fifty minutes between being granted the device and first using it. */
export async function askForMicrophone(): Promise<MicOutcome> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return "granted";
  } catch (e) {
    return micOutcome(e);
  }
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

export async function openMicrophone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("No microphone here", "NotFoundError");
  }
  return navigator.mediaDevices.getUserMedia(CONSTRAINTS);
}

/** A live reading of how loud the room is.
 *
 *  Bars are written straight onto elements as CSS custom properties rather
 *  than into React state: this ticks twenty times a second on a screen that
 *  also holds a transcript and a running clock, and re-rendering that tree at
 *  20Hz is the thing CODE_PRACTICES.md's rerender rules exist to prevent.
 *
 *  It also carries the peak, which is how "nothing reached the microphone" is
 *  told apart from "the room came through and speech did not". */
export interface Meter {
  /** Point the bars at their elements. Called once when they mount. */
  attach(bars: HTMLElement | null, halo: HTMLElement | null): void;
  /** Loudest thing heard since this meter opened, 0..1. */
  peak(): number;
  stop(): void;
}

const BARS = 24;
/** Twenty a second. The bars transition over 80ms, so anything faster is
 *  invisible and still costs a frame. */
const FRAME_MS = 50;

export function meterFor(stream: MediaStream): Meter {
  const AudioCtor = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) {
    /* No Web Audio: the level meter is decoration, and its absence must not
       stop somebody answering. The peak stays at zero, which would read as
       silence — so it returns 1 instead, meaning "cannot tell", and the
       silence check declines to fire rather than discarding a real answer. */
    return { attach: () => {}, peak: () => 1, stop: () => {} };
  }

  const audio = new AudioCtor();
  const source = audio.createMediaStreamSource(stream);
  const analyser = audio.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  const frame = new Uint8Array(analyser.fftSize);
  let barsEl: HTMLElement | null = null;
  let haloEl: HTMLElement | null = null;
  let highest = 0;
  let timer: number | null = null;
  let raf = 0;

  const tick = () => {
    raf = requestAnimationFrame(() => {
      analyser.getByteTimeDomainData(frame);
      const loudest = peakOf(frame);
      if (loudest > highest) highest = loudest;

      if (barsEl) {
        const heights = levelBars(frame, BARS);
        const children = barsEl.children;
        for (let i = 0; i < children.length && i < heights.length; i++) {
          (children[i] as HTMLElement).style.setProperty("--h", heights[i].toFixed(3));
        }
      }
      if (haloEl) haloEl.style.setProperty("--level", loudest.toFixed(2));
    });
  };

  timer = window.setInterval(tick, FRAME_MS);

  return {
    attach(bars, halo) {
      barsEl = bars;
      haloEl = halo;
    },
    peak: () => highest,
    stop() {
      if (timer !== null) window.clearInterval(timer);
      cancelAnimationFrame(raf);
      source.disconnect();
      void audio.close().catch(() => { /* already closed */ });
    },
  };
}

/** The recorded audio as Whisper needs it: one channel, 16000Hz, `Float32Array`.
 *
 *  Decoded rather than captured at that rate. ISSUE-0049 proposed
 *  `new AudioContext({ sampleRate: 16000 })` for capture, which is the risky
 *  form: Safari has a long history of ignoring or throwing on a non-default
 *  context rate, and iOS hardware runs at 48kHz. Resampling is what
 *  `decodeAudioData` is for, and it is reliable everywhere. */
export async function toPcm16k(blob: Blob): Promise<Float32Array> {
  const OfflineCtor = window.OfflineAudioContext
    ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  if (!OfflineCtor) throw new Error("This browser cannot decode the recording.");

  const bytes = await blob.arrayBuffer();
  const ctx = new OfflineCtor(1, 1, 16000);
  const decoded = await ctx.decodeAudioData(bytes);
  /* The first channel and no other. Constrained to mono at capture, so on
     every device that honoured the constraint this is the whole recording;
     where one did not, mixing would only add the room back in. */
  return decoded.getChannelData(0);
}

/** The container this browser will record into.
 *
 *  Safari does not do webm and everything else prefers opus. All of them
 *  decode through `decodeAudioData`, so the choice only has to be one that
 *  `MediaRecorder` accepts. */
export function recorderFor(stream: MediaStream): MediaRecorder {
  for (const mimeType of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported?.(mimeType)) {
      return new MediaRecorder(stream, { mimeType });
    }
  }
  return new MediaRecorder(stream);
}
