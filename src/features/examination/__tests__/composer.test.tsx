import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Composer } from "../components/Composer";
import { AnswerComposer } from "../components/AnswerComposer";
import { useDictationStore } from "@/features/dictation";

/* The typing path, fenced (ISSUE-0054).
 *
 * `Composer.tsx` is unmodified by the voice slice, and everything in that
 * slice rests on it: a refused microphone falls back here, a failed model
 * falls back here, and the Candidate choosing Type arrives here. These tests
 * exist so that remains true — they are a fence around a file, not a test of
 * new behaviour.
 */

describe("The typing composer", () => {
  it("submits the trimmed answer, and says nothing about how it arrived", () => {
    const onSubmit = vi.fn();
    render(
      <Composer disabled={false} sending={false} onSubmit={onSubmit} error={null} onRetry={vi.fn()} />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), {
      target: { value: "  Backprop is the chain rule.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));

    /* One argument. `spoken` defaults to false at the service, which is what
       keeps a typed answer typed without this file knowing the field exists. */
    expect(onSubmit).toHaveBeenCalledWith("Backprop is the chain rule.");
  });

  it("refuses to send an empty answer", () => {
    const onSubmit = vi.fn();
    render(
      <Composer disabled={false} sending={false} onSubmit={onSubmit} error={null} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /submit answer/i })).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends on ⌘↵", () => {
    const onSubmit = vi.fn();
    render(
      <Composer disabled={false} sending={false} onSubmit={onSubmit} error={null} onRetry={vi.fn()} />,
    );
    const box = screen.getByRole("textbox", { name: /your answer/i });
    fireEvent.change(box, { target: { value: "An answer." } });
    fireEvent.keyDown(box, { key: "Enter", metaKey: true });
    expect(onSubmit).toHaveBeenCalledWith("An answer.");
  });

  it("has no control for asking for a hint", () => {
    render(
      <Composer disabled={false} sending={false} onSubmit={vi.fn()} error={null} onRetry={vi.fn()} />,
    );
    /* The examiner offers one when the graph decides it is useful, and no
       route exists for the Candidate to request it. A button that did nothing
       would be worse than its absence. */
    expect(screen.queryByRole("button", { name: /hint/i })).not.toBeInTheDocument();
  });
});

describe("Which composer the Candidate gets", () => {
  beforeEach(() => {
    useDictationStore.setState({ mode: "speak", phase: "ready", engine: "whisper", device: "wasm" });
  });

  const props = {
    disabled: false, sending: false, onSubmit: vi.fn(), error: null, onRetry: vi.fn(),
  };

  it("gives the typing composer when the mode is type", () => {
    useDictationStore.setState({ mode: "type" });
    render(<AnswerComposer {...props} />);
    expect(screen.getByRole("textbox", { name: /your answer/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start speaking/i })).not.toBeInTheDocument();
  });

  it("gives the typing composer when no engine was ever acquired", () => {
    /* A Session resumed straight into `/examination/:id`. There is no download
       in progress and none will start, so a progress bar here would be one
       that never moves. */
    useDictationStore.setState({ mode: "speak", phase: "cold" });
    render(<AnswerComposer {...props} />);
    expect(screen.getByRole("textbox", { name: /your answer/i })).toBeInTheDocument();
  });

  it("offers the way back to speaking, so the choice is not one-way", () => {
    useDictationStore.setState({ mode: "type", phase: "ready" });
    render(<AnswerComposer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Speak" }));
    expect(useDictationStore.getState().mode).toBe("speak");
  });

  it("does not offer speaking where there is no engine to switch to", () => {
    useDictationStore.setState({ mode: "type", phase: "unavailable" });
    render(<AnswerComposer {...props} />);
    /* A control that reaches nothing is the thing AGENTS.md refuses. */
    expect(screen.queryByRole("group", { name: /how you answer/i })).not.toBeInTheDocument();
  });

  it("gives the speak surface when the engine is ready", () => {
    render(<AnswerComposer {...props} />);
    expect(screen.getByRole("button", { name: /start speaking/i })).toBeInTheDocument();
  });
});
