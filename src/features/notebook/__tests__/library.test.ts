import { describe, expect, it } from "vitest";
import type { Notebook, NotebookSource } from "@/shared/types";
import { inFlight } from "../hooks/useNotebooks";

const source = (over: Partial<NotebookSource>): NotebookSource => ({
  source_id: "src-1",
  module_id: "m-1",
  title: "Notes.pdf",
  state: "ready",
  stub_reason: null,
  progress_done: 0,
  progress_total: 0,
  selectable: true,
  topic_count: 0,
  elapsed_seconds: null,
  since_progress_seconds: null,
  ...over,
});

const library = (...sources: NotebookSource[]): Notebook[] => [{
  notebook_id: "nb-1",
  candidate_id: "cand-1",
  title: "My Library",
  embedding_model: "hashing-v1",
  visibility: "personal",
  created_at: "2026-09-01T00:00:00Z",
  sources,
}];

describe("polling the Library", () => {
  it("stops when nothing is in flight", () => {
    /* A timer that outlives the work holds an idle instance awake for nothing,
       and the free tier allows about one instance running full time. */
    expect(inFlight(library(source({})))).toBe(false);
    expect(inFlight(library(source({ state: "stub", selectable: false })))).toBe(false);
    expect(inFlight(library(source({ state: "failed", selectable: false })))).toBe(false);
    expect(inFlight(undefined)).toBe(false);
  });

  it("keeps polling while a document is being read", () => {
    expect(inFlight(library(source({ state: "uploaded", selectable: false })))).toBe(true);
    expect(inFlight(library(source({ state: "ingesting", selectable: false })))).toBe(true);
  });

  it("keeps polling while any one document is still in flight", () => {
    expect(inFlight(library(
      source({}),
      source({ source_id: "src-2", state: "ingesting", selectable: false }),
    ))).toBe(true);
  });
});
