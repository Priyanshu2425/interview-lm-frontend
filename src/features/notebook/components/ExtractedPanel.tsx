import type { NotebookSource, NotebookSourceDetail } from "@/shared/types";
import { Button, EmptyState, SkeletonLines } from "@/ui";

/* What the machine made of this document.
 *
 * There is no Module name here, and that is not an omission: a notebook
 * Module is titled with its own document's filename, so a name beside the
 * document's own header would either repeat it or invent one the record does
 * not hold. The id is what the Session picker will show. */
export function ExtractedPanel({ source, detail, loading, selectedTopic, onToggleTopic }: {
  source: NotebookSource | undefined;
  detail: NotebookSourceDetail | undefined;
  loading: boolean;
  selectedTopic: string | null;
  onToggleTopic: (topicId: string) => void;
}) {
  const head = (count?: number) => (
    <div className="col-head">
      <span className="eyebrow">What was extracted</span>
      {count === undefined ? null : (
        <span className="caption mono">{count} topic{count === 1 ? "" : "s"}</span>
      )}
    </div>
  );

  if (!source || source.state !== "ready") {
    return (
      <>
        {head()}
        <div className="col-body">
          <EmptyState
            icon="module"
            title="Nothing extracted"
            body="A document becomes examinable once it has been read into Topics. Until then it is kept, and listed, and nothing more."
          />
        </div>
      </>
    );
  }

  if (loading || !detail) {
    return (
      <>
        {head()}
        <div className="col-body"><SkeletonLines count={4} label="Reading the Topics" /></div>
      </>
    );
  }

  const selected = detail.topics.find((t) => t.topic_id === selectedTopic);

  return (
    <>
      {head(detail.topics.length)}
      <div className="col-body">
        <div className="mod">
          <div className="mod-head">
            <span className="mod-title">The Module</span>
            <span className="caption mono nowrap">{detail.module_id}</span>
          </div>
          <p className="caption mt-4">
            One Module, drawn from this document. Choosing it as a Session's scope
            examines the Topics below.
          </p>

          <ul className="topics">
            {detail.topics.map((t) => (
              <li key={t.topic_id}>
                <button
                  type="button"
                  className="topic"
                  aria-pressed={selectedTopic === t.topic_id}
                  onClick={() => onToggleTopic(t.topic_id)}
                >
                  <span className="topic-n">
                    {String(t.topic_order + 1).padStart(2, "0")}
                  </span>
                  <span className="topic-t">{t.title}</span>
                  <span className="topic-k">{t.dossier_tokens.toLocaleString()} tok</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selected ? (
          <div className="bar mt-6">
            <span className="caption">
              Showing where <strong style={{ color: "var(--fg)" }}>{selected.title}</strong> came from
            </span>
            <Button variant="ghost" size="sm" onClick={() => onToggleTopic(selected.topic_id)}>
              Show all
            </Button>
          </div>
        ) : (
          <p className="caption mt-6">
            Select a Topic to mark the passages of this document it was drawn from.
          </p>
        )}

        <p className="caption mt-6 hair-t" style={{ paddingTop: "var(--s-5)" }}>
          Topics are cut once, when the document is read, and then frozen — so the
          Evidence from a Session still points at the same material a month later.
        </p>
      </div>
    </>
  );
}
