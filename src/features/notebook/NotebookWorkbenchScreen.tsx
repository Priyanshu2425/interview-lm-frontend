import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Bench, PageHeader } from "@/shared/components";
import { useIsCompact } from "@/shared/hooks";
import { Button, ButtonLink, Dialog, ErrorState, SkeletonLines } from "@/ui";
import type { NotebookSource } from "@/shared/types";
import { useNotebook, useNotebookMutations } from "./hooks/useNotebooks";
import { useNotebookSource } from "./hooks/useNotebookSource";
import { DocumentList } from "./components/DocumentList";
import { SourceReading } from "./components/SourceReading";
import { ExtractedPanel } from "./components/ExtractedPanel";
import { AddDocumentsDialog } from "./components/AddDocumentsDialog";

export function NotebookWorkbenchScreen() {
  const { notebookId } = useParams();
  const compact = useIsCompact();
  const { data: notebook, isPending, error } = useNotebook(notebookId);
  const m = useNotebookMutations(notebookId);

  const [chosen, setChosen] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<NotebookSource | null>(null);

  /* Open on something worth reading. A notebook whose first document is a
     recording should not open on an empty pane. */
  const source = useMemo(() => {
    const sources = notebook?.sources ?? [];
    if (chosen) {
      const picked = sources.find((s) => s.source_id === chosen);
      if (picked) return picked;
    }
    return sources.find((s) => s.state === "ready") ?? sources[0];
  }, [notebook, chosen]);

  const detail = useNotebookSource(notebookId, source);

  const select = (sourceId: string) => {
    setChosen(sourceId);
    /* A Topic belongs to the document it was cut from; carrying the selection
       across would mark passages of a document it was never in. */
    setTopic(null);
  };

  if (error) {
    return (
      <>
        <PageHeader title="Notebook" back={{ to: "/notebook", label: "All notebooks" }} />
        <ErrorState
          title="That notebook could not be read"
          message={(error as Error).message}
          action={<ButtonLink to="/notebook" variant="primary">All notebooks</ButtonLink>}
        />
      </>
    );
  }

  if (isPending || !notebook) {
    return (
      <>
        <PageHeader title="Notebook" back={{ to: "/notebook", label: "All notebooks" }} />
        <div style={{ padding: "var(--s-9)" }}>
          <SkeletonLines count={4} label="Reading the notebook" />
        </div>
      </>
    );
  }

  const docs = notebook.sources.length;

  return (
    <>
      <PageHeader
        title={notebook.title}
        sub={compact ? undefined : `${docs} document${docs === 1 ? "" : "s"}`}
        back={{ to: "/notebook", label: compact ? "" : "All notebooks" }}
      >
        {/* A phone's topbar carries the title and one control. The label
            shortens rather than the button wrapping the row onto two lines. */}
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
          {compact ? "Add" : "Add documents"}
        </Button>
      </PageHeader>

      <Bench
        docs={
          <DocumentList
            sources={notebook.sources}
            selectedId={source?.source_id ?? null}
            onSelect={select}
            onRetry={(s) => m.retrySource.mutate({ sourceId: s.source_id, title: s.title })}
            onRemove={setRemoving}
          />
        }
        extracted={
          <ExtractedPanel
            source={source}
            detail={detail.data}
            loading={detail.isPending}
            selectedTopic={topic}
            onToggleTopic={(id) => setTopic((was) => (was === id ? null : id))}
          />
        }
      >
        <SourceReading
          source={source}
          detail={detail.data}
          loading={detail.isPending}
          selectedTopic={topic}
          onRetry={(s) => m.retrySource.mutate({ sourceId: s.source_id, title: s.title })}
        />
      </Bench>

      <AddDocumentsDialog
        open={adding}
        onClose={() => setAdding(false)}
        busy={m.addFiles.isPending || m.addText.isPending}
        onFiles={(files) => m.addFiles.mutate(files)}
        onText={(title, text) => m.addText.mutate({ title, text })}
      />

      <Dialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Remove this document?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
            <Button
              variant="primary"
              data-autofocus
              loading={m.removeSource.isPending}
              onClick={() => {
                if (removing) {
                  m.removeSource.mutate({ sourceId: removing.source_id, title: removing.title });
                }
                setRemoving(null);
              }}
            >
              Remove it
            </Button>
          </>
        }
      >
        Its Topics stop being examinable in future Sessions. Evidence already recorded
        against them stays on your record — it outlives the material it came from.
      </Dialog>
    </>
  );
}
