import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { NotebookSource, NotebookSourceDetail } from "@/shared/types";
import { SourceReading } from "../components/SourceReading";
import { ExtractedPanel } from "../components/ExtractedPanel";
import { DocumentList } from "../components/DocumentList";

const source = (over: Partial<NotebookSource> = {}): NotebookSource => ({
  source_id: "s1",
  module_id: "m1",
  title: "week-03.pdf",
  state: "ready",
  stub_reason: null,
  progress_done: 0,
  progress_total: 0,
  selectable: true,
  topic_count: 2,
  elapsed_seconds: null,
  since_progress_seconds: null,
  ...over,
});

const TEXT = "AAAABBBBCCCC";

const detail = (over: Partial<NotebookSourceDetail> = {}): NotebookSourceDetail => ({
  ...source(),
  notebook_id: "nb1",
  media_type: "application/pdf",
  byte_length: 1024,
  text: TEXT,
  pages: [],
  topics: [
    {
      topic_id: "t1", title: "The chain rule", topic_order: 0, dossier_tokens: 1840,
      spans: [{ chunk_id: "c1", page: 1, char_start: 0, char_end: 4 }],
    },
    {
      topic_id: "t2", title: "Gradient descent", topic_order: 1, dossier_tokens: 2210,
      spans: [{ chunk_id: "c2", page: 1, char_start: 4, char_end: 8 }],
    },
  ],
  ...over,
});

const noop = () => {};

describe("reading a document with its Topics marked on it", () => {
  it("marks the passages one Topic came from and dims the rest", () => {
    const { container, rerender } = render(
      <SourceReading source={source()} detail={detail()} loading={false}
                     selectedTopic={null} onRetry={noop} />,
    );
    expect(container.querySelectorAll(".span[data-lit]")).toHaveLength(0);
    expect(container.querySelectorAll(".span[data-dim]")).toHaveLength(0);

    rerender(
      <SourceReading source={source()} detail={detail()} loading={false}
                     selectedTopic="t1" onRetry={noop} />,
    );
    expect(container.querySelectorAll(".span[data-lit]")).toHaveLength(1);
    expect(container.querySelectorAll(".span[data-dim]").length).toBeGreaterThan(0);
    expect(container.querySelector(".span[data-lit]")?.textContent).toBe("AAAA");
  });

  it("renders no reading of any kind — this screen scores nothing", () => {
    const { container } = render(
      <SourceReading source={source()} detail={detail()} loading={false}
                     selectedTopic={null} onRetry={noop} />,
    );
    expect(container.textContent).not.toMatch(/\d\.\d\d/);
    expect(container.textContent).not.toMatch(/\bscore\b/i);
  });
});

describe("a document that is not ready", () => {
  it("says why it carried no text, and offers no retry", () => {
    /* A recording would fail the same way twice. Only an ingest that died
       part-way can be tried again. */
    render(
      <SourceReading
        source={source({ state: "stub", stub_reason: "no extractable text", topic_count: 0 })}
        detail={undefined} loading={false} selectedTopic={null} onRetry={noop}
      />,
    );
    expect(screen.getByText(/no extractable text/i)).toBeInTheDocument();
    expect(screen.getByText(/kept and listed rather than hidden/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try reading it again/i })).toBeNull();
  });

  it("offers a retry when the ingest is what failed", () => {
    const onRetry = vi.fn();
    render(
      <SourceReading
        source={source({ state: "failed", stub_reason: "the embedder stopped answering", topic_count: 0 })}
        detail={undefined} loading={false} selectedTopic={null} onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /try reading it again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows how far a document being read has got", () => {
    render(
      <SourceReading
        source={source({ state: "ingesting", progress_done: 14, progress_total: 40, topic_count: 0 })}
        detail={undefined} loading={false} selectedTopic={null} onRetry={noop}
      />,
    );
    expect(screen.getByText(/14 of 40 sections/)).toBeInTheDocument();
  });
});

describe("what was extracted", () => {
  it("names no Module, because a notebook Module has the document's own name", () => {
    const { container } = render(
      <ExtractedPanel source={source()} detail={detail()} loading={false}
                      selectedTopic={null} onToggleTopic={noop} />,
    );
    expect(screen.getByText("m1")).toBeInTheDocument();
    expect(container.textContent).not.toContain("week-03.pdf");
  });

  it("selects and clears a Topic", () => {
    const onToggle = vi.fn();
    render(
      <ExtractedPanel source={source()} detail={detail()} loading={false}
                      selectedTopic="t1" onToggleTopic={onToggle} />,
    );
    expect(screen.getByRole("button", { name: /the chain rule/i })).toHaveAttribute(
      "aria-pressed", "true",
    );
    fireEvent.click(screen.getByRole("button", { name: /show all/i }));
    expect(onToggle).toHaveBeenCalledWith("t1");
  });

  it("has nothing to show for a document that produced nothing", () => {
    render(
      <ExtractedPanel source={source({ state: "stub", topic_count: 0 })} detail={undefined}
                      loading={false} selectedTopic={null} onToggleTopic={noop} />,
    );
    expect(screen.getByText(/nothing extracted/i)).toBeInTheDocument();
  });
});

describe("the documents column", () => {
  it("is a list, not a second place to upload", () => {
    /* Adding documents is one action in one place — the topbar. */
    const { container } = render(
      <DocumentList sources={[source()]} selectedId="s1"
                    onSelect={noop} onRetry={noop} onRemove={noop} />,
    );
    expect(container.querySelector(".dropzone")).toBeNull();
    expect(container.querySelector("input[type=file]")).toBeNull();
  });

  it("says what became of each document", () => {
    render(
      <DocumentList
        sources={[source(), source({ source_id: "s2", state: "stub", stub_reason: "no extractable text", topic_count: 0 })]}
        selectedId="s1" onSelect={noop} onRetry={noop} onRemove={noop}
      />,
    );
    expect(screen.getByText("2 topics")).toBeInTheDocument();
    expect(screen.getByText("no extractable text")).toBeInTheDocument();
    expect(screen.getByText("Unusable")).toBeInTheDocument();
  });
});
