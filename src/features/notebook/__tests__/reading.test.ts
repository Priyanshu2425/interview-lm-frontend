import { describe, expect, it } from "vitest";
import type { ExtractedTopic, SourcePage } from "@/shared/types";
import { segments } from "../reading";

/* The client half of the claim the Notebook screen makes: a Topic highlights
   the passage it was actually cut from. The server guarantees the offsets are
   exact; this guarantees they are rendered where they point. */

const TEXT = "AAAABBBBCCCCDDDD";

const topic = (id: string, spans: [number, number][], page = 1): ExtractedTopic => ({
  topic_id: id,
  title: id,
  topic_order: 0,
  dossier_tokens: 10,
  spans: spans.map(([char_start, char_end], i) => ({
    chunk_id: `${id}-${i}`,
    page,
    char_start,
    char_end,
  })),
});

const page = (number: number, char_start: number, char_end: number): SourcePage => ({
  number,
  char_start,
  char_end,
  anchor: "",
});

const rebuild = (out: ReturnType<typeof segments>) =>
  out.filter((s) => s.kind !== "page").map((s) => s.text).join("");

describe("cutting a document at the offsets its Topics were cut from", () => {
  it("marks the span a Topic came from and leaves the rest alone", () => {
    const out = segments(TEXT, [], [topic("t1", [[4, 8]])]);
    expect(out).toEqual([
      { kind: "gap", text: "AAAA", topicId: undefined },
      { kind: "span", text: "BBBB", topicId: "t1" },
      { kind: "gap", text: "CCCCDDDD", topicId: undefined },
    ]);
  });

  it("renders every character exactly once, whatever the spans", () => {
    /* The property that matters more than any single case: the output is a
       partition of the text. A renderer cannot lose or repeat prose. */
    const out = segments(TEXT, [], [topic("t1", [[0, 4]]), topic("t2", [[8, 16]])]);
    expect(rebuild(out)).toBe(TEXT);
  });

  it("drops the whitespace between two spans rather than making a hole", () => {
    /* The one thing the partition does not keep, and deliberately: the blank
       line between two chunks is not prose, and a paragraph containing it
       renders as an empty box in the middle of the document. */
    const spaced = "AAAA\n\nBBBB";
    const out = segments(spaced, [], [
      topic("t1", [[0, 4]]),
      topic("t2", [[6, 10]]),
    ]);
    expect(out.map((s) => s.text)).toEqual(["AAAA", "BBBB"]);
    /* Prose between two spans is still kept — only whitespace goes. */
    const withProse = segments("AAAA and BBBB", [], [
      topic("t1", [[0, 4]]),
      topic("t2", [[9, 13]]),
    ]);
    expect(withProse.map((s) => s.text)).toEqual(["AAAA", " and ", "BBBB"]);
  });

  it("gives overlapping Topics one owner each, and prints nothing twice", () => {
    /* Two Topics can be cut from overlapping ranges. The earlier keeps the
       overlap; the later starts where it left off. */
    const out = segments(TEXT, [], [topic("t1", [[0, 10]]), topic("t2", [[6, 16]])]);
    expect(rebuild(out)).toBe(TEXT);
    const spans = out.filter((s) => s.kind === "span");
    expect(spans.map((s) => s.topicId)).toEqual(["t1", "t2"]);
    expect(spans[0].text).toBe("AAAABBBBCC");
    expect(spans[1].text).toBe("CCDDDD");
  });

  it("puts a page marker where the page begins, not where a span does", () => {
    const out = segments(
      TEXT,
      [page(1, 0, 8), page(2, 8, 16)],
      [topic("t1", [[10, 14]], 2)],
    );
    expect(out.filter((s) => s.kind === "page").map((s) => s.page)).toEqual([1, 2]);
    expect(rebuild(out)).toBe(TEXT);
  });

  it("shows a document with no page data as one continuous read", () => {
    /* Markdown and a pasted note have no pages. That is an absence, not a
       failure, and it must not produce a marker for a page that never was. */
    const out = segments(TEXT, [], [topic("t1", [[4, 8]])]);
    expect(out.some((s) => s.kind === "page")).toBe(false);
  });

  it("shows a document nothing was cut from as itself", () => {
    expect(segments(TEXT, [], [])).toEqual([
      { kind: "gap", text: TEXT, topicId: undefined },
    ]);
  });

  it("has nothing to show for a document with no text", () => {
    expect(segments("", [], [topic("t1", [[0, 4]])])).toEqual([]);
  });

  it("ignores a span that points outside the text it was given", () => {
    /* A re-extraction can leave an offset past the end. Clamping renders the
       part that exists rather than throwing away the document. */
    const out = segments(TEXT, [], [topic("t1", [[12, 999]]), topic("t2", [[5, 5]])]);
    expect(rebuild(out)).toBe(TEXT);
    expect(out.filter((s) => s.kind === "span")).toEqual([
      { kind: "span", text: "DDDD", topicId: "t1" },
    ]);
  });
});
