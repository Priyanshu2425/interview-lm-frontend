import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TouchedModule } from "@/shared/types";
import { TouchedModules } from "../components/TouchedModules";

const touched = (over: Partial<TouchedModule>): TouchedModule => ({
  module_id: "m-1",
  title: "Attention Mechanisms",
  track_key: "aiml",
  in_scope: false,
  edges: 3,
  score: 0.42,
  selectable: true,
  ...over,
});

describe("Modules the scope touches", () => {
  it("renders nothing at all when there is no sideways connection", () => {
    /* A Topic with no neighbours, a Library too small to have any, and a
       deployment holding none must look identical: no empty state, no copy. */
    const { container } = render(<TouchedModules touched={[]} onAdd={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    const absent = render(<TouchedModules touched={undefined} onAdd={vi.fn()} />);
    expect(absent.container).toBeEmptyDOMElement();
  });

  it("renders nothing when every touched Module is already in scope", () => {
    const { container } = render(
      <TouchedModules touched={[touched({ in_scope: true })]} onAdd={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the server's order and sorts nothing of its own", () => {
    render(
      <TouchedModules
        onAdd={vi.fn()}
        touched={[
          touched({ module_id: "m-1", title: "First", score: 0.1 }),
          touched({ module_id: "m-2", title: "Second", score: 0.9 }),
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(items[0]).toContain("First");
    expect(items[1]).toContain("Second");
  });

  it("says it is a claim about the material and not about the Candidate", () => {
    render(<TouchedModules touched={[touched({})]} onAdd={vi.fn()} />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/not of you/i);
    expect(body).not.toMatch(/mastery|coverage|should|recommend|improve/i);
  });

  it("counts connections rather than scoring them", () => {
    render(<TouchedModules touched={[touched({ edges: 3 })]} onAdd={vi.fn()} />);
    expect(screen.getByText(/3 connections/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("0.42");
  });
});
