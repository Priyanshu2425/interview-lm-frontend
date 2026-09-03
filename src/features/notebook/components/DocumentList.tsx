import type { NotebookSource, SourceState } from "@/shared/types";
import { Button, Icon, Meter, Tag } from "@/ui";
import type { TagTone } from "@/ui";

/* Five states, and what each reads as. `Unusable` and `Failed` are different
   facts: one is a document that carries no text at all, the other is one that
   does and whose embedding did not finish. Only the second can be retried. */
const STATE_LABEL: Record<SourceState, string> = {
  uploaded: "Waiting",
  ingesting: "Reading",
  ready: "Ready",
  failed: "Failed",
  stub: "Unusable",
};

const STATE_TONE: Record<SourceState, TagTone> = {
  uploaded: "accent",
  ingesting: "accent",
  ready: "ok",
  failed: "risk",
  stub: "warn",
};

const EXT = (title: string) => {
  const ext = title.split(".").pop()?.toUpperCase() ?? "";
  return ext.length > 0 && ext.length <= 4 ? ext : "DOC";
};

/* What became of this document, in its own words. Every state that is not
   `ready` says something: listed and greyed out with no explanation is the
   state `stub_reason` was written to prevent. */
function meta(s: NotebookSource): string {
  if (s.state === "ready") {
    return `${s.topic_count} topic${s.topic_count === 1 ? "" : "s"}`;
  }
  if (s.state === "ingesting" || s.state === "uploaded") {
    return `${s.progress_done} of ${s.progress_total} sections`;
  }
  return s.stub_reason ?? "";
}

export function DocumentList({ sources, selectedId, onSelect, onRetry, onRemove }: {
  sources: NotebookSource[];
  selectedId: string | null;
  onSelect: (sourceId: string) => void;
  onRetry: (source: NotebookSource) => void;
  onRemove: (source: NotebookSource) => void;
}) {
  return (
    <>
      <div className="col-head">
        <span className="eyebrow">In this notebook</span>
        <span className="caption mono">{sources.length}</span>
      </div>
      <div className="col-body">
        <div className="stack g-4">
          {sources.map((s) => (
            /* The row is a container, not a control: it holds the button that
               selects the document and the buttons that act on it, and a
               button inside a button is neither valid nor reachable. */
            <div
              key={s.source_id}
              className="doc-item"
              data-current={selectedId === s.source_id ? "" : undefined}
            >
              <button
                type="button"
                className="doc-open"
                aria-current={selectedId === s.source_id ? true : undefined}
                onClick={() => onSelect(s.source_id)}
              >
                <span className="doc-top">
                  <span className="ext">{EXT(s.title)}</span>
                  <span className="doc-name">{s.title}</span>
                </span>
                <span className="doc-meta">
                  <Tag tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Tag>
                  <span>{meta(s)}</span>
                </span>
                {s.state === "ingesting" || s.state === "uploaded" ? (
                  <Meter
                    value={s.progress_total ? s.progress_done / s.progress_total : 0}
                    label={`${s.title}: ${s.progress_done} of ${s.progress_total} sections read`}
                  />
                ) : null}
              </button>

              <span className="doc-actions">
                {/* Only a failed ingest can be tried again. A document that
                    carried no text would fail the same way twice. */}
                {s.state === "failed" ? (
                  <Button variant="secondary" size="sm" onClick={() => onRetry(s)}>
                    Try again
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${s.title}`}
                  onClick={() => onRemove(s)}
                >
                  <Icon name="trash" size={14} />
                </Button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
