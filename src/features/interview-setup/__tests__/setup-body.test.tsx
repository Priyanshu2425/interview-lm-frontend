import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { SetupBody } from "../components/SetupBody";
import type { SetupBodyProps } from "../components/SetupBody";
import { needsGesture } from "../hooks/useInterviewSetup";

/* The setup screen, driven by hand-built props (ISSUE-0053).
 *
 * This is what the split into `SetupBody` buys: every state below belongs to
 * a Candidate whose microphone was refused, or whose download stalled, or
 * whose Session never started — and none of them are reachable in a test that
 * has to drive a real `getUserMedia` and a real 172MB download to get there.
 */

const props = (over: Partial<SetupBodyProps> = {}): SetupBodyProps => ({
  steps: ["done", "done", "done"],
  ready: true,
  typing: false,
  fatal: null,
  engine: "whisper",
  micOutcome: "granted",
  engineReason: null,
  gestureNeeded: false,
  micAsked: true,
  download: { progress: 1, loaded: 172 * 1024 * 1024, total: 172 * 1024 * 1024, slow: false, device: "webgpu" },
  facts: { questions: 7, durationSeconds: 3000, modules: ["m-1", "m-2"] },
  sessionId: "s-1",
  beginning: false,
  beginError: null,
  onCheckMicrophone: vi.fn(),
  onBegin: vi.fn(),
  onCancel: vi.fn(),
  ...over,
});

const begin = () => screen.getByRole("button", { name: /begin/i });

describe("Setting up the interview", () => {
  it("does not begin the Session on its own", () => {
    const onBegin = vi.fn();
    render(<SetupBody {...props({ onBegin })} />);
    /* A clock that starts while the Candidate is looking at their phone is a
       clock they lost. Rendering the ready state must press nothing. */
    expect(onBegin).not.toHaveBeenCalled();
  });

  it("keeps Begin disabled while a check is still running", () => {
    render(<SetupBody {...props({ steps: ["done", "done", "now"], ready: false })} />);
    expect(begin()).toBeDisabled();
  });

  it("enables Begin when the microphone was refused, and says they will type", () => {
    /* The rule from ISSUE-0049: setup is never the reason somebody cannot sit
       their interview. A `fail` enables Begin exactly as a `done` does. */
    render(<SetupBody {...props({
      steps: ["done", "fail", "done"], typing: true, micOutcome: "denied",
    })} />);
    expect(begin()).toBeEnabled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("You will be typing.");
  });

  it("enables Begin when the model failed", () => {
    render(<SetupBody {...props({
      steps: ["done", "done", "fail"], typing: true, engineReason: "WebGPU is not available here.",
    })} />);
    expect(begin()).toBeEnabled();
    expect(screen.getByText("WebGPU is not available here.")).toBeInTheDocument();
  });

  it("blocks only when the plan failed, and shows the API's own message", () => {
    render(<SetupBody {...props({
      steps: ["fail", "wait", "wait"], ready: false,
      fatal: "Not enough Credits to start a Session of this length.",
    })} />);
    expect(screen.queryByRole("button", { name: /begin the interview/i })).not.toBeInTheDocument();
    /* Rendered from the message it arrived with. Composing billing copy here
       is what would let a Credit message reach a BYOK Candidate. */
    expect(screen.getByText("Not enough Credits to start a Session of this length."))
      .toBeInTheDocument();
  });

  it("names a slow connection as the cause and offers to begin anyway", () => {
    render(<SetupBody {...props({
      steps: ["done", "done", "now"], ready: false,
      download: { progress: 0.34, loaded: 58 * 1024 * 1024, total: 172 * 1024 * 1024, slow: true, device: null },
    })} />);
    expect(screen.getByRole("heading", { level: 1 }))
      .toHaveTextContent("Nearly there — your connection is slow today.");
    expect(begin()).toHaveTextContent("Begin now and type");
  });

  it("computes every figure in the disclosure, including the megabytes", () => {
    render(<SetupBody {...props({
      download: { progress: 0.5, loaded: 86 * 1024 * 1024, total: 172 * 1024 * 1024, slow: false, device: "wasm" },
    })} />);
    /* 172MB and not 60MB: the ticket that proposed this screen carried the
       wrong figure between three documents, which is what a computed one
       cannot do. */
    expect(screen.getByText(/172MB/)).toBeInTheDocument();
    expect(screen.queryByText(/60MB/)).not.toBeInTheDocument();
  });

  it("leaves the Questions fact out rather than inventing a count", () => {
    render(<SetupBody {...props({ facts: { questions: null, durationSeconds: 1500, modules: ["m-1"] } })} />);
    expect(screen.queryByText("Questions")).not.toBeInTheDocument();
    expect(screen.getByText("Time")).toBeInTheDocument();
    expect(screen.getByText("Scope")).toBeInTheDocument();
  });

  describe("the privacy line", () => {
    /* ISSUE-0049's "the screen says so" criterion: present in every state, in
       the same place, and true of the engine that will actually run. */
    const states: Array<[string, Partial<SetupBodyProps>]> = [
      ["ready", {}],
      ["still checking", { steps: ["done", "now", "wait"], ready: false }],
      ["microphone refused", { steps: ["done", "fail", "done"], typing: true, micOutcome: "denied" }],
      ["the plan failed", { steps: ["fail", "wait", "wait"], ready: false, fatal: "no" }],
    ];

    it.each(states)("is present when %s", (_name, over) => {
      render(<SetupBody {...props(over)} />);
      expect(screen.getByText(/never leaves this browser/i)).toBeInTheDocument();
    });

    it("says the audio is sent when the engine is the browser's own", () => {
      render(<SetupBody {...props({ engine: "webspeech" })} />);
      expect(screen.getByText(/sends what you say to its own speech service/i))
        .toBeInTheDocument();
      expect(screen.queryByText(/never leaves this browser/i)).not.toBeInTheDocument();
    });
  });
});

describe("Whether the microphone needs a gesture", () => {
  it("is true on iOS, where getUserMedia refuses outside one", () => {
    expect(needsGesture("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5)).toBe(true);
    expect(needsGesture("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)", 5)).toBe(true);
  });

  it("is true on an iPad claiming to be a Mac, told apart by the touchscreen", () => {
    expect(needsGesture("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
  });

  it("is false on a real Mac and on Windows", () => {
    expect(needsGesture("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(needsGesture("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0)).toBe(false);
  });
});
