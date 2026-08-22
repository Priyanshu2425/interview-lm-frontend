import { describe, expect, it } from "vitest";
import { bandClass, isReportable } from "../band";
import { credits, score } from "../format";
import { betaGeometry, floorGeometry } from "@/ui/data/beta";

/* These are the product's rules, not the UI's preferences. Each one is a
   thing that must stay true no matter what a later change makes convenient. */

describe("the Evidence Floor", () => {
  it("maps an untested band to the treatment with no fill", () => {
    expect(bandClass("untested")).toBe("band-untested");
  });

  it("never reports an untested Topic as reportable", () => {
    expect(isReportable("untested")).toBe(false);
    expect(isReportable("early")).toBe(true);
    expect(isReportable("firm_weak")).toBe(true);
    expect(isReportable("firm_strong")).toBe(true);
  });

  it("gives the lowest firm band the risk hue and nothing else", () => {
    expect(bandClass("firm_weak")).toBe("band-fragile");
    expect(bandClass("firm_strong")).toBe("band-solid");
    expect(bandClass("early")).toBe("band-partial");
  });
});

describe("Credits", () => {
  it("renders an em dash off the Credits route, never a zero", () => {
    expect(credits(0, "byok")).toBe("—");
    expect(credits(null, "byok")).toBe("—");
    expect(credits(120, "byok")).toBe("—");
  });

  it("renders the real figure on the Credits route", () => {
    expect(credits(1200, "credits")).toBe("1,200 Cr");
  });

  it("renders an em dash for a null balance even on the Credits route", () => {
    expect(credits(null, "credits")).toBe("—");
  });

  it("renders a genuine zero balance as zero, not as an em dash", () => {
    expect(credits(0, "credits")).toBe("0 Cr");
  });
});

describe("a score", () => {
  it("is an em dash when there is none, never 0.00", () => {
    expect(score(null)).toBe("—");
    expect(score(undefined)).toBe("—");
  });
  it("always carries two decimals", () => {
    expect(score(0.8)).toBe("0.80");
    expect(score(1)).toBe("1.00");
  });
});

describe("the Beta renderer", () => {
  it("draws a path from alpha and beta rather than from a mastery figure", () => {
    const g = betaGeometry(9, 4, 200, 60);
    expect(g.line.startsWith("M")).toBe(true);
    expect(g.line.length).toBeGreaterThan(200);
    expect(g.area.endsWith("Z")).toBe(true);
  });

  it("puts the mean where alpha/(alpha+beta) says it is", () => {
    expect(betaGeometry(9, 1, 100, 40).meanX).toBeCloseTo(90, 5);
    expect(betaGeometry(1, 1, 100, 40).meanX).toBeCloseTo(50, 5);
  });

  it("produces finite coordinates at the prior, where the density is flat", () => {
    const g = betaGeometry(1, 1, 200, 60);
    expect(g.line).not.toMatch(/NaN|Infinity/);
  });

  it("produces finite coordinates for a sharply peaked posterior", () => {
    const g = betaGeometry(400, 3, 200, 60);
    expect(g.line).not.toMatch(/NaN|Infinity/);
  });

  it("has a floor treatment that carries no fill and no mean", () => {
    const f = floorGeometry(200, 60);
    expect(f.axis).toContain("M0");
    expect(f.ghost).toContain("C");
    expect(JSON.stringify(f)).not.toMatch(/Z$/);
  });
});
