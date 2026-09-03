import type { Citation } from "@/shared/types";

/* The exact span of the exact source behind a question.

   Citations are snapshotted onto the Evidence row at grading time — they are
   not looked up afterwards, so a Topic graded on model judgment alone honestly
   has none, and the Evidence outlives the material it was taken against.

   One renderer, because there is one thing being shown. It used to live on the
   examination screen; since ISSUE-0042 the answer turn carries no citations at
   all, so the report is where a span is read. */
export function SourceSpan({ citation }: { citation: Citation }) {
  return (
    <div className="source">
      <div className="eyebrow">{citation.title || citation.source_id}</div>
      <p className="source-span">{citation.text}</p>
      <div className="source-ref">
        {citation.page === null ? null : <span>p. {citation.page}</span>}
        <span>chunk {citation.chunk_id}</span>
        <span>{citation.source_id}</span>
      </div>
    </div>
  );
}
