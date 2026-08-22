import type { Citation } from "@/shared/types";
import { EmptyState } from "@/ui";

/* The exact span of the exact source behind the question. Citations are
   snapshotted onto the Evidence row at grading time — they are not looked up
   afterwards, and a Topic graded on model judgment alone honestly has none. */
export function GroundingPanel({ citations, mode }: {
  citations: Citation[];
  mode: string | undefined;
}) {
  if (citations.length === 0) {
    return (
      <EmptyState
        icon="source"
        title={
          mode === "model_judgment"
            ? "This question is anchored to a syllabus, not to a span"
            : "No span is bound to this question yet"
        }
        body={
          mode === "model_judgment"
            ? "Graded on the interviewer's own knowledge, and weighted accordingly. There is no passage to show, and inventing one would be worse than saying so."
            : "The grounding arrives with the graded answer."
        }
      />
    );
  }

  return (
    <div className="stack g-6">
      <p className="caption" style={{ margin: 0 }}>The span behind the question on screen.</p>
      {citations.map((c) => (
        <div className="source" key={c.chunk_id}>
          <div className="eyebrow">{c.title || c.source_id}</div>
          <p className="source-span">{c.text}</p>
          <div className="source-ref">
            {c.page === null ? null : <span>p. {c.page}</span>}
            <span>chunk {c.chunk_id}</span>
            <span>{c.source_id}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
