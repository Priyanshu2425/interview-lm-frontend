import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { VoiceComposer } from "../components/VoiceComposer";
import { useDictationStore } from "@/features/dictation";
import type { MicOutcome, Recording } from "@/features/dictation";

/* Answering out loud (ISSUE-0054).
 *
 * The engine is mocked at the barrel, which is the seam it was given one for:
 * a `Worker`, a `MediaStream` and an `AudioContext` are all things jsdom does
 * not have, and stubbing them one level down would be a test of the stub. The
 * store is real, because the states below are the store's.
 */

const SAID = "Backprop is the chain rule applied to a graph.";

const startListening = vi.fn<() => Promise<MicOutcome>>();
const stopListening = vi.fn<() => Promise<Recording>>();

vi.mock("@/features/dictation", async (original) => {
  const actual = await original<typeof import("@/features/dictation")>();
  return {
    ...actual,
    startListening: (...a: unknown[]) => startListening(...(a as [])),
    stopListening: (...a: unknown[]) => stopListening(...(a as [])),
    cancelListening: vi.fn(),
    attachMeter: vi.fn(),
  };
});

const props = () => ({
  disabled: false, sending: false, onSubmit: vi.fn(), error: null, onRetry: vi.fn(),
});

const mic = () => screen.getByRole("button", { name: /start speaking|stop and transcribe/i });

beforeEach(() => {
  vi.clearAllMocks();
  startListening.mockResolvedValue("granted");
  stopListening.mockResolvedValue({ heard: "speech", result: { text: SAID, marks: [] } });
  useDictationStore.setState({
    phase: "ready", engine: "whisper", device: "wasm", mode: "speak",
    heard: null, reason: null, progress: 1, interim: "",
  });
});

describe("Answering out loud", () => {
  it("sends nothing while listening — an Answer Turn is a deliberate act", async () => {
    const p = props();
    render(<VoiceComposer {...p} />);
    fireEvent.click(mic());
    await waitFor(() => expect(screen.getByRole("button", { name: /stop and transcribe/i })).toBeInTheDocument());
    expect(p.onSubmit).not.toHaveBeenCalled();
  });

  it("puts the transcript in an editable field before anything is sent", async () => {
    const p = props();
    render(<VoiceComposer {...p} />);
    fireEvent.click(mic());
    await waitFor(() => screen.getByRole("button", { name: /stop and transcribe/i }));
    fireEvent.click(screen.getByRole("button", { name: /stop and transcribe/i }));

    const box = await screen.findByRole("textbox", { name: /your answer, as transcribed/i });
    expect(box).toHaveValue(SAID);
    /* Nothing has gone to the grader. The confirmation step is the design. */
    expect(p.onSubmit).not.toHaveBeenCalled();
  });

  it("records the turn as spoken even when the transcript was corrected first", async () => {
    const p = props();
    render(<VoiceComposer {...p} />);
    fireEvent.click(mic());
    await waitFor(() => screen.getByRole("button", { name: /stop and transcribe/i }));
    fireEvent.click(screen.getByRole("button", { name: /stop and transcribe/i }));

    const box = await screen.findByRole("textbox", { name: /your answer, as transcribed/i });
    /* "pie torch" corrected to "PyTorch" is exactly the edit this box exists
       for, and it is still a machine's reading of a voice — which is the audit
       question `spoken` was added to answer (ISSUE-0050). */
    fireEvent.change(box, { target: { value: "PyTorch builds the graph as it runs." } });
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(p.onSubmit).toHaveBeenCalledWith("PyTorch builds the graph as it runs.", true);
  });

  it("tells the two silences apart, and sends neither", async () => {
    for (const [heard, expected] of [
      ["silent", /nothing reached the microphone/i],
      ["too-short", /heard the room, but no speech/i],
    ] as const) {
      stopListening.mockResolvedValue({ heard, result: null });
      const p = props();
      const { unmount } = render(<VoiceComposer {...p} />);
      fireEvent.click(mic());
      await waitFor(() => screen.getByRole("button", { name: /stop and transcribe/i }));
      fireEvent.click(screen.getByRole("button", { name: /stop and transcribe/i }));

      act(() => useDictationStore.setState({ heard }));
      expect(await screen.findByText(expected)).toBeInTheDocument();
      expect(p.onSubmit).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("refuses to submit what the model invented for a silent room", async () => {
    /* Fed near-silence, Whisper emits a confident short sentence from its
       training distribution. Unhandled, "Thank you." becomes an Answer Turn
       and is graded. */
    stopListening.mockResolvedValue({ heard: "speech", result: { text: "Thank you.", marks: [] } });
    const p = props();
    render(<VoiceComposer {...p} />);
    fireEvent.click(mic());
    await waitFor(() => screen.getByRole("button", { name: /stop and transcribe/i }));
    fireEvent.click(screen.getByRole("button", { name: /stop and transcribe/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /start speaking/i })).toBeInTheDocument());
    expect(screen.queryByRole("textbox", { name: /as transcribed/i })).not.toBeInTheDocument();
    expect(p.onSubmit).not.toHaveBeenCalled();
  });

  it("leaves the Session usable when the microphone is refused", async () => {
    startListening.mockResolvedValue("denied");
    render(<VoiceComposer {...props()} />);
    fireEvent.click(mic());

    /* The typing composer, inline, plus the way back. The Session is fine. */
    expect(await screen.findByRole("textbox", { name: /your answer/i })).toBeInTheDocument();
    expect(screen.getByText(/will not give us the microphone/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try the microphone again/i })).toBeInTheDocument();
  });

  it("keeps typing reachable while the model is still warming, and names no megabytes", () => {
    useDictationStore.setState({ phase: "preparing", progress: 0.4 });
    render(<VoiceComposer {...props()} />);
    expect(screen.getByRole("button", { name: /type this answer/i })).toBeInTheDocument();
    /* They are mid-examination. The only fact that helps is that they can type
       this one right now — not how big the download is. */
    expect(screen.queryByText(/MB/)).not.toBeInTheDocument();
  });

  it("says how long transcribing takes, in terms it can be held to", () => {
    useDictationStore.setState({ phase: "transcribing" });
    render(<VoiceComposer {...props()} />);
    /* Measured at 0.37–0.45× realtime (ISSUE-0052). "A few seconds" is false
       for a forty-second answer, and a false wait is worse than a long one. */
    expect(screen.getByText(/about half as long as you spoke for/i)).toBeInTheDocument();
    expect(screen.queryByText(/a few seconds/i)).not.toBeInTheDocument();
  });

  it("computes nothing about the answer", async () => {
    const { container } = render(<VoiceComposer {...props()} />);
    fireEvent.click(mic());
    await waitFor(() => screen.getByRole("button", { name: /stop and transcribe/i }));
    fireEvent.click(screen.getByRole("button", { name: /stop and transcribe/i }));
    await screen.findByRole("textbox", { name: /as transcribed/i });

    /* No word count, no percentage, no confidence figure presented as quality.
       Whether an answer is any good is the Judge's question. */
    expect(container.textContent).not.toMatch(/\d+\s*words?/i);
    expect(container.textContent).not.toMatch(/\d+%/);
    expect(container.textContent).not.toMatch(/confiden/i);
  });

  it("matches its privacy claim to the engine that actually ran", () => {
    const { rerender } = render(<VoiceComposer {...props()} />);
    expect(screen.getByText(/never leaves this browser/i)).toBeInTheDocument();

    act(() => useDictationStore.setState({ engine: "webspeech" }));
    rerender(<VoiceComposer {...props()} />);
    expect(screen.getByText(/sends what you say to its own speech service/i)).toBeInTheDocument();
  });

  it("announces its own state, for somebody who cannot see the button turn red", async () => {
    render(<VoiceComposer {...props()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");

    fireEvent.click(mic());
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Listening."));
  });

  it("names every control it shows", async () => {
    render(<VoiceComposer {...props()} />);
    expect(screen.getByRole("button", { name: "Start speaking" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("group", { name: "How you answer" })).toBeInTheDocument();

    fireEvent.click(mic());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Stop and transcribe" }))
        .toHaveAttribute("aria-pressed", "true"),
    );
  });
});
