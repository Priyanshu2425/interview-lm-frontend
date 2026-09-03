/// <reference lib="webworker" />

/* The model, and nothing else in the application, ever.
 *
 * It is here rather than on the main thread because both halves of the work
 * block: the download is tens of megabytes and the inference is seconds of
 * arithmetic. The screen either of them would freeze is the one with a Session
 * clock on it and a question waiting to be answered.
 *
 * This file is compiled by `tsconfig.worker.json`, which is `WebWorker` and not
 * `DOM`. It may not reach for `window`, and nothing in `src/` may import it
 * except through `?worker`.
 */

import type { FromWorker, ToWorker, Device, DictationErrorCode } from "./protocol";

/* Typed once here rather than at every call site: `self` in a worker is a
   `DedicatedWorkerGlobalScope`, and TypeScript will not narrow it for us. */
const ctx = self as unknown as DedicatedWorkerGlobalScope;

const post = (m: FromWorker, transfer?: Transferable[]) =>
  ctx.postMessage(m, transfer ?? []);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Transcriber = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{ text: string }>;

let transcriber: Transcriber | null = null;
let device: Device = "wasm";

/** Ids the main thread gave up on. The model cannot be interrupted mid-decode
 *  — `generate` has no abort — so a cancel marks the answer dead and its
 *  result is dropped when it arrives. Saying that plainly beats a `cancel`
 *  that looks like it stops work and does not. */
const abandoned = new Set<string>();

function classify(e: unknown): DictationErrorCode {
  const message = String((e as Error)?.message ?? e ?? "");
  if (/webgpu|gpu adapter/i.test(message)) return "no_webgpu";
  if (/out of memory|allocation|RangeError/i.test(message)) return "out_of_memory";
  if (/fetch|network|failed to load|404|HTTP/i.test(message)) return "download_failed";
  if (/WebAssembly|wasm|SharedArrayBuffer/i.test(message)) return "unsupported_browser";
  return "inference_failed";
}

async function load(msg: Extract<ToWorker, { type: "load" }>) {
  const started = Date.now();

  /* Imported here rather than at the top of the file so that the three
     megabytes of runtime are fetched when a Candidate is actually going to
     speak, and not by every visitor who opened the Mastery map. */
  const { pipeline, env } = await import("@huggingface/transformers");

  /* `env.backends.onnx.wasm.wasmPaths` is deliberately not set.
     The library's documented default is jsdelivr, which the API's
     `default-src 'self'` refuses (ISSUE-0050) — so this looked like it needed
     overriding to a copy of our own. It does not: the loader reaches for the
     runtime through `new URL(..., import.meta.url)`, which the bundler
     rewrites to a hashed asset on our own origin. The default is already
     same-origin once built, and pointing it at a hand-copied file instead
     produces a 404 in dev, where Vite will not serve a `.mjs` out of
     `public/`. Measured working; do not "fix" this by setting it. */
  void env;

  device = msg.device;

  transcriber = (await pipeline("automatic-speech-recognition", msg.model, {
    device: msg.device,
    dtype: "q8",
    progress_callback: (p: any) => {
      /* Fired per file and per state; only the download states carry byte
         counts worth reporting. Aggregating them is the main thread's job
         (`progressOf`), where it can be tested without a worker. */
      if (p?.status === "progress" && typeof p.total === "number") {
        post({ type: "progress", file: String(p.file ?? ""), loaded: p.loaded ?? 0, total: p.total });
      }
    },
  } as any)) as unknown as Transcriber;

  /* One run on a second of silence, so the first real answer is not also the
     one that pays for allocating every intermediate tensor. It costs a second
     here, before the clock starts, instead of ten in the middle of a question. */
  try {
    await transcriber(new Float32Array(16000), { chunk_length_s: 30 });
  } catch {
    /* A warm-up that fails is not a load that failed. If the model is really
       broken the first genuine answer will say so, with an id attached and a
       Candidate to tell. */
  }

  post({ type: "ready", device, ms: Date.now() - started });
}

async function transcribe(msg: Extract<ToWorker, { type: "transcribe" }>) {
  if (!transcriber) {
    post({
      type: "error", id: msg.id, stage: "transcribe",
      code: "inference_failed", message: "The transcriber was asked to work before it was ready.",
    });
    return;
  }
  const started = Date.now();
  const out = await transcriber(msg.pcm, {
    /* Whisper's own window. Thirty seconds with five of overlap is the
       documented pairing; a shorter stride drops words across the seam. */
    chunk_length_s: 30,
    stride_length_s: 5,
    /* Deliberately no `language`. An English-only checkpoint throws on it —
       "Cannot specify `task` or `language` for an English-only model" — and
       every model this ships with is one. ISSUE-0049's worker sketch passed
       it and would have failed on the first call. */
  });

  if (abandoned.has(msg.id)) {
    abandoned.delete(msg.id);
    return;
  }
  post({
    type: "result",
    id: msg.id,
    text: (out?.text ?? "").trim(),
    /* Empty, and see `WordMark`. There is no per-word confidence to report. */
    marks: [],
    ms: Date.now() - started,
  });
}

ctx.addEventListener("message", (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  void (async () => {
    try {
      if (msg.type === "load") return await load(msg);
      if (msg.type === "transcribe") return await transcribe(msg);
      if (msg.type === "cancel") return void abandoned.add(msg.id);
    } catch (e) {
      /* Every failure leaves by this door.
         `tests/run.mjs` fails the whole suite on one uncaught console error,
         and more to the point a Candidate mid-examination needs to be told
         something rather than watching a button that stopped working. */
      post({
        type: "error",
        id: msg.type === "transcribe" ? msg.id : null,
        stage: msg.type === "load" ? "load" : "transcribe",
        code: classify(e),
        message: String((e as Error)?.message ?? e),
      });
    }
  })();
});

/* A rejection nobody awaited would otherwise reach the console and take the
   e2e suite with it. It is reported like any other failure and then swallowed
   deliberately. */
ctx.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
  event.preventDefault();
  post({
    type: "error", id: null, stage: "transcribe",
    code: classify(event.reason),
    message: String(event.reason?.message ?? event.reason),
  });
});
