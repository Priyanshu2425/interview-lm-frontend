import { useEffect, useMemo, useRef } from "react";
import type { NotebookSource, NotebookSourceDetail } from "@/shared/types";
import { Button, EmptyState, Meter, SkeletonLines, Tag } from "@/ui";
import { useReducedMotion } from "@/shared/hooks";
import { segments } from "../reading";

/* The document, with the Topics marked on it.
 *
 * What is shown is the text an extractor made of the document — a cache of it,
 * not the document itself. The original bytes are kept elsewhere and are not
 * served here, so the copy says "extracted" rather than implying a page. */
export function SourceReading({ source, detail, loading, selectedTopic, onRetry }: {
  source: NotebookSource | undefined;
  detail: NotebookSourceDetail | undefined;
  loading: boolean;
  selectedTopic: string | null;
  onRetry: (source: NotebookSource) => void;
}) {
  const reducedMotion = useReducedMotion();
  const firstLit = useRef<HTMLParagraphElement | null>(null);

  /* Cut once per document. Selecting a Topic only changes which pieces are
     marked, so it must not make the text be walked again. */
  const cut = useMemo(
    () => (detail ? segments(detail.text, detail.pages, detail.topics) : []),
    [detail],
  );

  /* Bring the first marked passage into view: a Topic three pages down should
     not have to be hunted for. */
  useEffect(() => {
    if (!selectedTopic) return;
    firstLit.current?.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [selectedTopic, reducedMotion]);

  if (!source) {
    return (
      <>
        <div className="col-head"><span className="eyebrow">Document</span></div>
        <div className="col-body">
          <EmptyState
            icon="source"
            title="No document chosen"
            body="Pick one from the left to read it and see what was made of it."
          />
        </div>
      </>
    );
  }

  const head = (
    <div className="col-head">
      <span className="row g-4" style={{ minWidth: 0 }}>
        <span className="ext">{source.title.split(".").pop()?.toUpperCase() ?? "DOC"}</span>
        <span className="doc-name" style={{ color: "var(--fg)" }}>{source.title}</span>
      </span>
      {detail && source.state === "ready" ? (
        <span className="caption mono">
          {detail.pages.length ? `${detail.pages.length} pages · ` : ""}
          {detail.text.length.toLocaleString()} characters
        </span>
      ) : null}
    </div>
  );

  /* A state is data. None of these is an error, and a document that vanished
     from this pane would look like one that never arrived. */
  if (source.state !== "ready") {
    const reading = source.state === "ingesting" || source.state === "uploaded";
    return (
      <>
        {head}
        <div className="col-body">
          <EmptyState
            icon={reading ? "timer" : "source"}
            title={reading ? "Being read" : "No text to show"}
            body={
              reading
                ? `This document is being read — ${source.progress_done} of ${source.progress_total} sections. It becomes examinable when it finishes.`
                : source.stub_reason ?? ""
            }
            action={
              source.state === "failed" ? (
                <Button variant="primary" onClick={() => onRetry(source)}>
                  Try reading it again
                </Button>
              ) : undefined
            }
          />
          {reading ? (
            <div className="mt-6" style={{ maxWidth: 280, marginInline: "auto" }}>
              <Meter
                value={source.progress_total ? source.progress_done / source.progress_total : 0}
                label={`${source.progress_done} of ${source.progress_total} sections read`}
              />
            </div>
          ) : null}
          {source.state === "stub" ? (
            <p className="caption mt-6" style={{ maxWidth: "46ch", marginInline: "auto", textAlign: "center" }}>
              It is kept and listed rather than hidden — a document that vanished would
              look like one that never arrived.
            </p>
          ) : null}
        </div>
      </>
    );
  }

  if (loading || !detail) {
    return (
      <>
        {head}
        <div className="col-body"><SkeletonLines count={6} label="Reading the document" /></div>
      </>
    );
  }

  let lit = 0;
  return (
    <>
      {head}
      <div className="col-body">
        <div className="reading">
          {cut.map((piece, i) => {
            if (piece.kind === "page") {
              return <span className="pg" key={`p-${i}`}>page {piece.page}</span>;
            }
            const marked = piece.topicId === selectedTopic;
            const first = marked && lit++ === 0;
            return (
              <p
                key={i}
                className="span"
                ref={first ? firstLit : undefined}
                data-lit={marked ? "" : undefined}
                data-dim={selectedTopic && !marked ? "" : undefined}
              >
                {piece.text}
              </p>
            );
          })}
        </div>
        <p className="caption mt-8" style={{ maxWidth: "64ch" }}>
          This is the text an extractor read out of the document, and it is what the
          Topics were cut from. <Tag>{detail.media_type}</Tag>
        </p>
      </div>
    </>
  );
}
