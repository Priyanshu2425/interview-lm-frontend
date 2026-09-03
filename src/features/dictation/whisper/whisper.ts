/* Distil-Whisper's smaller cousin, in a worker, on this machine.
 *
 * The Candidate's voice never leaves the browser on this arm. That is the
 * whole argument for it, and it is what the 77MB buys.
 */

import DictationWorker from "./worker?worker";
import { MODEL, DEFAULT_DEVICE, type Device, type FromWorker, type ToWorker } from "./protocol";
import type { PrepareOutcome, Recording, Transcriber } from "../transcriber";
import { micOutcome, progressOf, whatWasHeard, type FileProgress, type MicOutcome } from "../helpers";
import { meterFor, openMicrophone, recorderFor, toPcm16k, type Meter } from "../capture";

let nextId = 0;

export function whisperTranscriber(): Transcriber {
  let worker: Worker | null = null;
  let ready: Promise<PrepareOutcome> | null = null;
  let device: Device | null = null;

  const files: Record<string, FileProgress> = {};
  const pending = new Map<string, {
    resolve: (r: { text: string; ms: number }) => void;
    reject: (e: Error) => void;
  }>();

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let meter: Meter | null = null;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let bars: HTMLElement | null = null;
  let halo: HTMLElement | null = null;

  function releaseMicrophone() {
    meter?.stop();
    meter = null;
    for (const t of stream?.getTracks() ?? []) t.stop();
    stream = null;
    recorder = null;
  }

  return {
    id: "whisper",
    /* It hears the whole answer at once. There is nothing to show while the
       Candidate is still speaking except how loud they are. */
    streams: false,

    device: () => device,

    prepare(onProgress) {
      /* Idempotent: the setup screen calls this, and under StrictMode it calls
         it twice. Two workers would mean two downloads of the same 77MB. */
      if (ready) return ready;

      ready = new Promise<PrepareOutcome>((resolve) => {
        const w = new DictationWorker();
        worker = w;

        w.addEventListener("message", (event: MessageEvent<FromWorker>) => {
          const msg = event.data;
          if (msg.type === "progress") {
            files[msg.file] = { loaded: msg.loaded, total: msg.total };
            let loaded = 0;
            let total = 0;
            for (const f of Object.values(files)) {
              loaded += f.loaded;
              total += f.total;
            }
            onProgress({ value: progressOf(files), loaded, total });
            return;
          }
          if (msg.type === "ready") {
            device = msg.device;
            resolve({ ok: true, device: msg.device });
            return;
          }
          if (msg.type === "result") {
            pending.get(msg.id)?.resolve({ text: msg.text, ms: msg.ms });
            pending.delete(msg.id);
            return;
          }
          if (msg.type === "error") {
            if (msg.id) {
              pending.get(msg.id)?.reject(new Error(msg.message));
              pending.delete(msg.id);
              return;
            }
            /* No id: it failed while loading, so nobody is waiting on an
               answer and everybody is waiting on the engine. */
            resolve({ ok: false, reason: msg.message });
          }
        });

        /* A worker that dies takes every answer in flight with it, and the
           Candidate must not be left holding a button that stopped working. */
        w.addEventListener("error", () => {
          const failed = new Error("The transcriber stopped unexpectedly.");
          for (const p of pending.values()) p.reject(failed);
          pending.clear();
          resolve({ ok: false, reason: failed.message });
        });

        const load: ToWorker = { type: "load", model: MODEL, device: DEFAULT_DEVICE };
        w.postMessage(load);
      });

      return ready;
    },

    async start(): Promise<MicOutcome> {
      try {
        stream = await openMicrophone();
      } catch (e) {
        return micOutcome(e);
      }
      meter = meterFor(stream);
      meter.attach(bars, halo);
      chunks = [];
      recorder = recorderFor(stream);
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      });
      recorder.start();
      startedAt = Date.now();
      return "granted";
    },

    async stop(): Promise<Recording> {
      const rec = recorder;
      const durationMs = Date.now() - startedAt;
      const peak = meter?.peak() ?? 0;

      const blob = await new Promise<Blob>((resolve) => {
        if (!rec || rec.state === "inactive") return resolve(new Blob(chunks));
        rec.addEventListener("stop", () => resolve(
          new Blob(chunks, { type: rec.mimeType || "audio/webm" }),
        ), { once: true });
        rec.stop();
      });

      /* Before anything else, and always. The recording light going out is the
         Candidate's evidence that we stopped listening when they said so, and
         it must not wait on a decode. */
      releaseMicrophone();

      const heard = whatWasHeard(peak, durationMs);
      if (heard !== "speech") return { heard, result: null };

      const pcm = await toPcm16k(blob);
      const id = `t${++nextId}`;
      const text = await new Promise<{ text: string; ms: number }>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const msg: ToWorker = { type: "transcribe", id, pcm };
        /* Transferred, not cloned. After this the buffer here is detached,
           which is correct: the audio has one destination. */
        worker?.postMessage(msg, [pcm.buffer]);
      });

      return { heard: "speech", result: { text: text.text, marks: [] } };
    },

    cancel() {
      for (const id of pending.keys()) {
        const msg: ToWorker = { type: "cancel", id };
        worker?.postMessage(msg);
      }
      pending.clear();
      releaseMicrophone();
    },

    attachMeter(nextBars, nextHalo) {
      bars = nextBars;
      halo = nextHalo;
      meter?.attach(nextBars, nextHalo);
    },

    dispose() {
      releaseMicrophone();
      worker?.terminate();
      worker = null;
      ready = null;
    },
  };
}
