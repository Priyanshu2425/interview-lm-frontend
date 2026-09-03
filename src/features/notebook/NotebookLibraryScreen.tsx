import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { PageHeader, Workbench } from "@/shared/components";
import {
  Button, Dialog, EmptyState, ErrorState, Panel, SkeletonLines, Tag, TextField,
} from "@/ui";
import { relativeTime } from "@/shared/utils/format";
import type { Notebook } from "@/shared/types";
import { inFlightSources, useNotebookMutations, useNotebooks } from "./hooks/useNotebooks";

/* What a notebook is worth saying from the outside: how much is in it, and
   whether anything in it needs a person. Everything else is inside. */
function summarise(n: Notebook): string {
  const docs = n.sources.length;
  const topics = n.sources.reduce((total, s) => total + s.topic_count, 0);
  const bits = [`${docs} document${docs === 1 ? "" : "s"}`];
  if (topics) bits.push(`${topics} topic${topics === 1 ? "" : "s"}`);
  if (n.created_at) bits.push(`added ${relativeTime(n.created_at)}`);
  return bits.join(" · ");
}

const needsAttention = (n: Notebook) =>
  n.sources.filter((s) => s.state === "failed" || s.state === "stub").length;

export function NotebookLibraryScreen() {
  const { data: notebooks, isPending, error } = useNotebooks();
  const { create } = useNotebookMutations(undefined);
  const navigate = useNavigate();

  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");

  /* A title is set once and kept: there is no route that renames a notebook,
     so asking now is the difference between a name and "Untitled notebook"
     forever. */
  const make = () => {
    const named = title.trim();
    if (!named) return;
    create.mutate(named, {
      onSuccess: (notebook) => {
        setNaming(false);
        setTitle("");
        navigate(`/notebook/${notebook.notebook_id}`, { viewTransition: true });
      },
    });
  };

  const newNotebook = (
    <Button variant="primary" size="sm" onClick={() => setNaming(true)}>
      New notebook
    </Button>
  );

  return (
    <>
      <PageHeader title="Notebook">{newNotebook}</PageHeader>

      <Workbench>
        <p className="eyebrow">Your material</p>
        <h1 className="display-3 mt-4">Everything you have brought.</h1>
        <p className="prose mt-6">
          Documents you add to a notebook are read into Modules and Topics, and those
          are what a Session can examine you on. Nothing here is shared, and nothing
          here is anybody else's — a Skill somebody else assembled is chosen when you
          set up a Session.
        </p>

        {error ? (
          <div className="mt-9">
            <ErrorState
              title="Your notebooks could not be read"
              message={(error as Error).message}
            />
          </div>
        ) : isPending ? (
          <div className="mt-9"><SkeletonLines count={3} label="Reading your notebooks" /></div>
        ) : notebooks && notebooks.length > 0 ? (
          <>
            <Panel className="mt-9" style={{ overflow: "hidden" }}>
              {notebooks.map((n) => (
                <Link key={n.notebook_id} className="nb-row" to={`/notebook/${n.notebook_id}`}>
                  <span className="nb-glyph">{n.sources.length}</span>
                  <span>
                    <span className="nb-title">{n.title}</span>
                    <span className="nb-sub">{summarise(n)}</span>
                  </span>
                  <span className="row g-4" style={{ flexWrap: "wrap" }}>
                    {inFlightSources(n.sources) ? <Tag tone="accent">Reading</Tag> : null}
                    {needsAttention(n) ? (
                      <Tag tone="warn">{needsAttention(n)} need attention</Tag>
                    ) : null}
                    <span className="caption mono">open ›</span>
                  </span>
                </Link>
              ))}
            </Panel>
            <p className="caption mt-5">
              A notebook is a folder of your own material. Deleting one retires its
              Topics from every future Session — the Evidence they produced stays on
              your record.
            </p>
          </>
        ) : (
          <div className="mt-9">
            <EmptyState
              icon="notebook"
              title="No notebooks yet"
              body="A notebook holds the documents you want to be examined on. Make one, then add material to it."
              action={
                <Button variant="primary" onClick={() => setNaming(true)}>
                  New notebook
                </Button>
              }
            />
          </div>
        )}
      </Workbench>

      <Dialog
        open={naming}
        onClose={() => setNaming(false)}
        title="Name this notebook"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNaming(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={make}
              loading={create.isPending}
              loadingLabel="Creating…"
              disabled={!title.trim()}
            >
              Create and open
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => { e.preventDefault(); make(); }}
        >
          <TextField
            label="Name"
            hint="It is kept as you write it, and there is no way to change it later."
            placeholder="Deep Learning — my notes"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            data-autofocus
          />
        </form>
      </Dialog>
    </>
  );
}
