/* What crosses the worker boundary, and nothing else.
 *
 * Shared by two TypeScript projects — the app, which is `DOM`, and the worker,
 * which is `WebWorker` — so this file may name neither. Types and plain literal
 * unions only. `verbatimModuleSyntax` is on, so every import of these is
 * `import type`.
 */

/** Which runtime the model was loaded onto. Reported, because "why was that
 *  slow" is a question worth being able to answer. */
export type Device = "webgpu" | "wasm";

export type LoadStage = "load" | "warm" | "transcribe";

export type DictationErrorCode =
  | "no_webgpu"
  | "download_failed"
  | "out_of_memory"
  | "unsupported_browser"
  | "inference_failed";

/** Where in the transcript a word was heard with low confidence.
 *
 *  Always empty. Transformers.js exposes no per-word confidence — `scores` and
 *  `logits` are commented-out TODOs in its own `generate` — and inventing a
 *  client-side list of "terms it usually mangles" would be the surface holding
 *  an invariant, which ADR-0009 refuses. The field exists so that a real
 *  measurement later is a data change rather than a redesign. */
export interface WordMark {
  start: number;
  end: number;
}

export interface TranscriptionResult {
  text: string;
  marks: WordMark[];
}

/* -- main → worker --------------------------------------------------------- */

export type ToWorker =
  | { type: "load"; model: string; device: Device }
  /** `pcm` is transferred rather than cloned. A sixty-second answer is 3.8MB
   *  and the audio has exactly one destination, so the main thread's view is
   *  detached afterwards — which is correct, not a leak. */
  | { type: "transcribe"; id: string; pcm: Float32Array }
  | { type: "cancel"; id: string };

/* -- worker → main --------------------------------------------------------- */

export type FromWorker =
  /** Per file, not aggregate: there are four of them and they differ in size
   *  by 20×, so summing is a weighted job the main thread does (`progressOf`)
   *  where it can be tested without a worker. */
  | { type: "progress"; file: string; loaded: number; total: number }
  | { type: "ready"; device: Device; ms: number }
  | { type: "result"; id: string; text: string; marks: WordMark[]; ms: number }
  | {
      type: "error";
      id: string | null;
      stage: LoadStage;
      code: DictationErrorCode;
      message: string;
    };

/* -- what is loaded, and why it is this ------------------------------------ */

/** Measured 2026-09-03 against ten answers carrying this product's vocabulary:
 *  `whisper-base.en` lost 8.1% of technical terms, `distil-small.en` lost
 *  10.8% at 2.2× the download and half the speed. The smaller model is the
 *  more accurate one, which is not what ISSUE-0049 assumed.
 *
 *  One constant, so swapping it is one line — see ISSUE-0052 for the method. */
export const MODEL = "onnx-community/whisper-base.en";

/** ~77MB: a 23.2MB encoder and a 53.7MB merged decoder, plus tokenizer and
 *  config. Used only to show a plausible total before the first `progress`
 *  event names the real one; every figure a Candidate sees is measured, never
 *  this. */
export const APPROX_MODEL_BYTES = 77 * 1024 * 1024;

/** WebGPU is opt-in and stays that way until somebody measures it.
 *
 *  `device: "webgpu"` with `dtype: "q8"` — the pair ISSUE-0049 specified —
 *  emits gibberish for Whisper (transformers.js#1317, open). The working
 *  WebGPU configuration is fp32 encoder with a q4 decoder, which is 206MB:
 *  larger than the CPU path, not smaller. So the fast path is also the fat
 *  one, and wasm at q8 is the default. */
export const DEFAULT_DEVICE: Device = "wasm";
