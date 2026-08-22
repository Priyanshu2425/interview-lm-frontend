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
