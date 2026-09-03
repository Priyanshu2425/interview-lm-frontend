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

/* -- The Judge reads two dimensions (ISSUE-0043) -------------------------- */

describe("the two sub-scores", () => {
  /* `source_score` is how much of the supplied material an answer explained;
     `truth_score` is how close to correct it was. The average of two
     different questions answers neither, and the combination that fed the
     posterior is an input to the maths rather than a reading. The refusal is
     enforced the way the others are — by an absent function. */
  it("has no helper that takes both", async () => {
    const format = await import("../format");
    const band = await import("../band");
    const exported: unknown[] = Object.values({ ...format, ...band });
    const binary = exported.filter(
      (v): v is (a: unknown, b: unknown) => unknown =>
        typeof v === "function" && v.length >= 2,
    );
    /* Any two-argument helper here must not be one that fuses two readings.
       `credits(value, route)` and `bandClass(band)` are the shapes allowed:
       a value and a context, never a value and a second value. */
    for (const fn of binary) {
      expect(fn(0.9, 0.7)).not.toBe(0.8);
      expect(fn(0.9, 0.7)).not.toBe("0.80");
    }
  });

  it("renders either one absent as an em dash, never as a zero", () => {
    /* Under model judgment there is no Answer Key, so `source_score` is null
       — and a 0.00 there would read as "explained none of the material". */
    expect(score(null)).toBe("\u2014");
    expect(score(undefined)).toBe("\u2014");
    expect(score(0)).toBe("0.00");
  });
});

/* -- Untested is not zero, on a Session that never reached a Topic -------- */

describe("a Topic the Session never reached", () => {
  it("is not reportable, and has no band to render", () => {
    /* The report builds unreached Topics into a shape with no band field at
       all, so there is nothing for `bandClass` to be asked about. This holds
       the rule one level down: untested never becomes a readable band. */
    expect(isReportable("untested")).toBe(false);
    expect(bandClass("untested")).toBe("band-untested");
  });
});
