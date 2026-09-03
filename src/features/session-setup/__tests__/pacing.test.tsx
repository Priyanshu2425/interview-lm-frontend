import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Scope } from "@/shared/types";
import { SessionPreview } from "../components/SessionPreview";

const scope = (over: Partial<Scope> = {}): Scope => ({
  module_count: 2,
  topic_count: 12,
  ground_truth_topic_count: 5,
  strongest_mode: "ground_truth",
  suggested_seconds: 2160,
  minimum_seconds: 720,
  questions_at_full_coverage: 12,
  ...over,
});

const preview = (s: Scope | undefined, durationSeconds = 1500) => render(
  <SessionPreview
    scope={s}
    loadingScope={false}
    moduleCount={2}
    durationSeconds={durationSeconds}
    provider="deepseek"
    onBegin={() => {}}
    starting={false}
    blocked={null}
  />,
);

describe("a scope suggests a time", () => {
  it("shows the three figures the server sent", () => {
    preview(scope());
    /* Read off the row, not off the page: a scope of twelve Topics needing
       twelve questions puts the same numeral in two honest places. */
    const figure = (label: string) =>
      screen.getByText(label).closest(".between")?.querySelector("strong")?.textContent;
    expect(figure("Questions at full coverage")).toBe("12");
    expect(figure("Suggested")).toBe("36 minutes");
    expect(figure("Minimum")).toBe("12 minutes");
  });

  it("says nothing about time before a scope has been chosen", () => {
    const { container } = preview(undefined);
    expect(container.textContent).not.toMatch(/What this scope needs/i);
  });

  /* The reading is Coverage — derived from Topic count and nothing else. A
     figure derived from how much text a Topic holds would be a difficulty
     reading wearing a clock's clothes, and difficulty is not recorded. */
  it("names no difficulty and quotes no price", () => {
    const { container } = preview(scope());
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/difficult|hard|easy|advanced|beginner/i);
    expect(text).toMatch(/Not quoted before it is knowable/i);
  });
});

describe("a clock too short for the scope", () => {
  it("states what will happen, and does not block", () => {
    preview(scope(), 600);   // under the 720s minimum
    expect(screen.getByText(/cannot reach every Topic/i)).toBeInTheDocument();
    /* A statement, not a validation error: a short clock is a legitimate
       choice that buys a compressed plan. */
    expect(screen.getByRole("button", { name: /begin session/i })).toBeEnabled();
  });

  it("promises unasked rather than zero", () => {
    preview(scope(), 600);
    expect(screen.getByText(/never as a zero/i)).toBeInTheDocument();
  });

  it("says nothing when the clock is long enough", () => {
    const { container } = preview(scope(), 3000);
    expect(container.textContent).not.toMatch(/cannot reach every Topic/i);
  });
});
