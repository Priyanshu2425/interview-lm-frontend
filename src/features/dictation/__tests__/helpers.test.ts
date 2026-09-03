import { describe, expect, it } from "vitest";
import {
  armFor, canBegin, engineLabel, forcedToType, hasWebSpeech, isSlow, levelBars,
  looksLikeSilence, micOutcome, peakOf, privacyLine, privacyOf, progressOf,
  setupSteps, throughput, whatWasHeard,
  IMPATIENT_AFTER_MS, SLOW_AFTER_MS, SLOW_BYTES_PER_SECOND, TOO_SHORT_MS,
  type SetupProgress,
} from "../helpers";

/* Nothing here touches a Worker, a MediaStream or an AudioContext, which is
   why it can be tested at all — jsdom has none of the three, and a stub of one
   is a claim about coverage rather than coverage. Everything the engine
   decides lives in these functions for that reason. */

const KB = 1024;
const MB = 1024 * KB;

describe("how far along the download is", () => {
  it("is nothing before any file has a size", () => {
    expect(progressOf({})).toBe(0);
    expect(progressOf({ a: { loaded: 0, total: 0 } })).toBe(0);
  });

  /* The model is four files that differ in size by more than twenty times.
     Averaging their percentages would show the tokenizer finishing instantly
     and then sit at 25% for the whole of the real download. */
  it("weighs a file by its bytes, not by being a file", () => {
    const files = {
      tokenizer: { loaded: 1 * MB, total: 1 * MB },   // done
      decoder: { loaded: 0, total: 53 * MB },         // not started
    };
    expect(progressOf(files)).toBeLessThan(0.05);
  });

  it("never exceeds one, however the counts arrive", () => {
    expect(progressOf({ a: { loaded: 99 * MB, total: 10 * MB } })).toBe(1);
  });

  it("ignores a file whose size is not known yet", () => {
    const files = {
      known: { loaded: 5 * MB, total: 10 * MB },
      unknown: { loaded: 3 * MB, total: 0 },
    };
    expect(progressOf(files)).toBeCloseTo(0.5, 5);
  });
});

describe("whether the connection is worth naming", () => {
  it("says nothing about a rate it cannot measure", () => {
    expect(throughput([])).toBeNull();
    expect(throughput([{ at: 0, loaded: 0 }])).toBeNull();
  });

  it("reads bytes per second off the trailing window", () => {
    const rate = throughput([
      { at: 0, loaded: 0 },
      { at: 1000, loaded: 100 * KB },
      { at: 2000, loaded: 200 * KB },
    ]);
    expect(rate).toBeCloseTo(100 * KB, -2);
  });

  /* Every download starts at zero, so anything judged in the first seconds is
     judging the handshake. */
  it("calls nothing slow before it has had a chance", () => {
    expect(isSlow(1, SLOW_AFTER_MS - 1)).toBe(false);
  });

  it("calls a genuinely slow download slow", () => {
    expect(isSlow(SLOW_BYTES_PER_SECOND / 2, SLOW_AFTER_MS + 1)).toBe(true);
    expect(isSlow(SLOW_BYTES_PER_SECOND * 4, SLOW_AFTER_MS + 1)).toBe(false);
  });

  /* Past a point the measured rate stops mattering. The Session is open from
     the moment it was created, so somebody still waiting here needs to be told
     they can stop rather than reassured that the bytes are moving. */
  it("stops defending a long wait however fast the bytes are", () => {
    expect(isSlow(SLOW_BYTES_PER_SECOND * 100, IMPATIENT_AFTER_MS)).toBe(true);
  });
});

describe("the level meter", () => {
  /* 128 is silence on this scale. A meter that idles at a lively wobble tells
     somebody whose microphone is muted at the OS that we can hear them, and
     they find out a minute later holding an answer they have to give again. */
  it("draws digital silence as silence", () => {
    const silent = new Uint8Array(256).fill(128);
    expect(levelBars(silent, 8)).toEqual(new Array(8).fill(0));
    expect(peakOf(silent)).toBe(0);
  });

  it("draws a loud frame as loud, and a quiet one as less", () => {
    const loud = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 250 : 6));
    const quiet = Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 140 : 116));
    const [l] = levelBars(loud, 4);
    const [q] = levelBars(quiet, 4);
    expect(l).toBeGreaterThan(q);
    expect(l).toBeLessThanOrEqual(1);
    expect(q).toBeGreaterThan(0);
  });

  it("gives back exactly the number of bars asked for", () => {
    const frame = new Uint8Array(256).fill(200);
    expect(levelBars(frame, 24)).toHaveLength(24);
    expect(levelBars(frame, 3)).toHaveLength(3);
  });

  it("survives a frame that never arrived", () => {
    expect(levelBars(new Uint8Array(0), 4)).toEqual([0, 0, 0, 0]);
  });
});

describe("whether anything was actually said", () => {
  it("tells a fragment from a silence", () => {
    expect(whatWasHeard(0.5, TOO_SHORT_MS - 1)).toBe("too-short");
    expect(whatWasHeard(0.001, 5000)).toBe("silent");
    expect(whatWasHeard(0.4, 5000)).toBe("speech");
  });

  /* Fed near-silence, Whisper emits a confident short sentence out of its
     training distribution. Unhandled, a Candidate who pressed the button by
     accident submits "Thank you." as an Answer Turn and is graded on it. */
  it("recognises the model talking to itself", () => {
    for (const said of ["", "   ", "Thank you.", "you", "Bye.", "[BLANK_AUDIO]", "..."]) {
      expect(looksLikeSilence(said), said).toBe(true);
    }
  });

  it("leaves a real answer alone", () => {
    expect(looksLikeSilence(
      "The dot products grow with the dimension, so the softmax saturates.",
    )).toBe(false);
  });

  /* This decides whether an Answer Turn exists, never whether it is any good.
     A short answer is the Judge's business. */
  it("does not mistake a brief answer for silence", () => {
    expect(looksLikeSilence("It vanishes.")).toBe(false);
  });
});

describe("what a refused microphone means", () => {
  /* Three different facts, and the screen says different things about them: a
     refusal can be undone in the address bar, a missing device cannot, and an
     insecure context is our deployment's problem rather than theirs. */
  it("tells refusal, absence and impossibility apart", () => {
    expect(micOutcome({ name: "NotAllowedError" })).toBe("denied");
    expect(micOutcome({ name: "NotFoundError" })).toBe("no-device");
    expect(micOutcome({ name: "SomethingElse" })).toBe("unsupported");
    expect(micOutcome(undefined)).toBe("unsupported");
  });
});

describe("the setup screen's three checks", () => {
  const pending: SetupProgress = { plan: "pending", microphone: "pending", engine: "pending" };

  it("marks only the first unsettled step as the one happening now", () => {
    expect(setupSteps(pending)).toEqual(["now", "wait", "wait"]);
    expect(setupSteps({ ...pending, plan: "done" })).toEqual(["done", "now", "wait"]);
    expect(setupSteps({ ...pending, plan: "done", microphone: "done" }))
      .toEqual(["done", "done", "now"]);
  });

  /* A stalled download reads as 1✓ 2✓ 3⟳, which is the whole argument for
     three checks over one changing line. */
  it("carries on past a step that failed", () => {
    expect(setupSteps({ plan: "done", microphone: "fail", engine: "pending" }))
      .toEqual(["done", "fail", "now"]);
  });

  /* ISSUE-0049's rule — setup is never the reason somebody cannot sit their
     interview — as an expression rather than a sentence in a document. A
     sentence drifts; this cannot. */
  it("lets the Candidate begin with a microphone that was refused", () => {
    expect(canBegin({ plan: "done", microphone: "fail", engine: "done" })).toBe(true);
  });

  it("lets the Candidate begin with no speech recognition at all", () => {
    expect(canBegin({ plan: "done", microphone: "done", engine: "fail" })).toBe(true);
  });

  it("lets them begin when both failed", () => {
    expect(canBegin({ plan: "done", microphone: "fail", engine: "fail" })).toBe(true);
  });

  /* The one exception, and not as a policy: a Session that failed to start
     does not exist, so there is nothing to begin. */
  it("does not offer to begin a Session that was never made", () => {
    expect(canBegin({ plan: "fail", microphone: "done", engine: "done" })).toBe(false);
    expect(canBegin({ plan: "pending", microphone: "done", engine: "done" })).toBe(false);
  });

  it("waits for a step that is still going", () => {
    expect(canBegin({ plan: "done", microphone: "done", engine: "pending" })).toBe(false);
  });

  it("settles on typing when either half of speaking failed", () => {
    expect(forcedToType({ plan: "done", microphone: "fail", engine: "done" })).toBe(true);
    expect(forcedToType({ plan: "done", microphone: "done", engine: "fail" })).toBe(true);
    expect(forcedToType({ plan: "done", microphone: "done", engine: "done" })).toBe(false);
  });
});

describe("which arm a Candidate is in", () => {
  it("finds the browser's speech service under either name", () => {
    expect(hasWebSpeech({ SpeechRecognition: () => {} })).toBe(true);
    expect(hasWebSpeech({ webkitSpeechRecognition: () => {} })).toBe(true);
  });

  /* Firefox has no implementation of any kind, so a third of desktop can never
     be in that arm. A comparison that quietly excluded them would still be a
     comparison, but not of what it claimed. */
  it("never assigns an arm the browser does not have", () => {
    expect(hasWebSpeech({})).toBe(false);
    expect(armFor("cand_anything", false)).toBe("whisper");
  });

  /* Somebody asked which of two experiences was better needs to have had one
     of them, not a coin flip per question. */
  it("gives the same Candidate the same arm every time", () => {
    const first = armFor("cand_7f21a", true);
    for (let i = 0; i < 20; i++) expect(armFor("cand_7f21a", true)).toBe(first);
  });

  it("does not put everybody in the same arm", () => {
    const ids = Array.from({ length: 40 }, (_, i) => `cand_${i}`);
    const arms = new Set(ids.map((id) => armFor(id, true)));
    expect(arms.size).toBe(2);
  });
});

describe("what the Candidate is told about where their voice goes", () => {
  /* Not decoration. Whisper runs here and the audio never leaves; the browser's
     speech service ships it to Google or Apple. A screen that said otherwise
     in that arm would be lying about a microphone in an examination. */
  it("does not claim on-device for the arm that is not", () => {
    expect(privacyOf("whisper")).toBe("on-device");
    expect(privacyOf("webspeech")).toBe("sent-to-vendor");
  });

  it("says plainly that the browser's service is sent the audio", () => {
    expect(privacyLine("whisper")).toMatch(/never leaves this browser/i);
    expect(privacyLine("webspeech")).toMatch(/sends what you say/i);
    expect(privacyLine("webspeech")).not.toMatch(/never leaves/i);
  });

  it("names the runtime that actually ran", () => {
    expect(engineLabel("whisper", "wasm")).toBe("CPU");
    expect(engineLabel("whisper", "webgpu")).toBe("WebGPU");
    expect(engineLabel("webspeech", null)).toBe("Browser speech");
  });
});

describe("what dictation refuses to do", () => {
  /* The surface computes nothing about an answer. These functions decide
     whether an Answer Turn exists to send — never whether it is any good. */
  it("has no function that scores, counts or judges an answer", () => {
    const surface = {
      progressOf, throughput, isSlow, levelBars, peakOf, whatWasHeard,
      looksLikeSilence, micOutcome, setupSteps, canBegin, forcedToType,
      armFor, hasWebSpeech, privacyOf, privacyLine, engineLabel,
    };
    for (const name of Object.keys(surface)) {
      expect(name).not.toMatch(/score|grade|band|mastery|coverage|quality|confiden/i);
    }
  });
});
