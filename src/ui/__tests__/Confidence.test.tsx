import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BetaCurve, Reading } from "../Confidence";

/* The rule that must survive every refactor: below the floor there is a word
   and no number, and there is no prop that changes that. */

describe("Reading", () => {
  it("renders the word and no numeral for an untested Topic", () => {
    render(<Reading band="untested" label="Untested" mastery={null} />);
    expect(screen.getByText("Untested")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d\.\d\d/);
  });

  it("still refuses a numeral when a mastery figure is handed in with an untested band", () => {
    render(<Reading band="untested" label="Untested" mastery={0.82} />);
    expect(document.body.textContent).not.toMatch(/\d\.\d\d/);
  });

  it("renders the figure once the band is reportable", () => {
    render(<Reading band="firm_strong" label="Looks solid" mastery={0.82} />);
    expect(screen.getByText("0.82")).toBeInTheDocument();
    expect(screen.getByText("mastery")).toBeInTheDocument();
  });
});

describe("BetaCurve", () => {
  it("draws no distribution and no mean line below the floor", () => {
    const { container } = render(
      <BetaCurve alpha={1.2} beta={1.1} band="untested" label="Untested" mastery={null} />,
    );
    expect(container.querySelector(".beta-line")).toBeNull();
    expect(container.querySelector(".beta-area")).toBeNull();
    expect(container.querySelector(".beta-mean")).toBeNull();
    expect(container.querySelector(".beta-floor")).not.toBeNull();
  });

  it("says in its accessible name that there is no reading", () => {
    render(<BetaCurve alpha={1.2} beta={1.1} band="untested" label="Untested" mastery={null} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/no reading/i);
  });

  it("draws the curve, the area and the mean above the floor", () => {
    const { container } = render(
      <BetaCurve alpha={9} beta={4} band="firm_strong" label="Looks solid" mastery={0.69} />,
    );
    expect(container.querySelector(".beta-line")?.getAttribute("d")?.length).toBeGreaterThan(200);
    expect(container.querySelector(".beta-area")).not.toBeNull();
    expect(container.querySelector(".beta-mean")).not.toBeNull();
  });
});

/* ISSUE-0020's colour rule, at the one place it was being broken: a band drawn
   as a tint says nothing to a greyscale screen or a screen reader. */
describe("a band is never carried by colour alone", () => {
  it("says which band a reportable figure falls in", () => {
    render(<Reading band="firm_weak" label="Looks weak" mastery={0.41} />);
    expect(screen.getByText("Looks weak")).toBeInTheDocument();
  });

  it("takes the word from the server rather than deriving it from the figure", () => {
    /* The same number in two bands. If the surface were computing the band it
       would have to disagree with one of these — and a second implementation of
       the Evidence Floor is exactly what ADR-0009 refuses. */
    const { unmount } = render(<Reading band="firm_weak" label="Looks weak" mastery={0.6} />);
    expect(screen.getByText("Looks weak")).toBeInTheDocument();
    unmount();
    render(<Reading band="firm_strong" label="Looks solid" mastery={0.6} />);
    expect(screen.getByText("Looks solid")).toBeInTheDocument();
  });
});
