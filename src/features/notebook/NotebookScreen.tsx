import { useMemo, useState } from "react";
import { PageHeader, Workbench } from "@/shared/components";
import {
  Button, ButtonLink, CostUnknown, Dialog, EmptyState, ErrorState, Icon, Meter, Panel, SectionHead,
  SkeletonLines, Tag, TextAreaField, TextField,
} from "@/ui";
import type { Notebook, NotebookSource } from "@/shared/types";
import { useModules } from "@/features/session-setup";
import { useNotebookMutations, useNotebooks } from "./hooks/useNotebooks";
import { Dropzone } from "./components/Dropzone";

/* Five states, and what each reads as. `Unusable` and `Failed` are different
   facts: one is a document that carries no text at all, the other is a document
   that does and whose embedding did not finish. Only the second can be retried. */
const STATE_LABEL: Record<NotebookSource["state"], string> = {
  uploaded: "Waiting",
  ingesting: "Reading",
  ready: "Ready",
  failed: "Failed",
  stub: "Unusable",
};

const STATE_TONE: Record<NotebookSource["state"], "ok" | "warn" | "risk" | "accent"> = {
  uploaded: "accent",
  ingesting: "accent",
  ready: "ok",
  failed: "risk",
  stub: "warn",
};

/* Why this document is where it is. Every state that is not `ready` says
   something: listed and greyed out with no explanation is the state
   `stub_reason` was written to prevent, and an un-ingested document lands in
   exactly the same place. */
function docMeta(s: NotebookSource): string {
  if (s.state === "ready") return `module ${s.module_id}`;
  if (s.state === "stub") return s.stub_reason ?? "no extractable text";
  if (s.state === "failed") return s.stub_reason ?? "the ingest did not finish";
  if (s.state === "uploaded") return "kept, and waiting to be read";
  return "being read now";
}

const EXT_LABEL = (title: string) => {
  const ext = title.split(".").pop()?.toUpperCase() ?? "";
  return ext.length > 0 && ext.length <= 4 ? ext : "DOC";
};

export function NotebookScreen() {
  const { data: notebooks, isPending, error } = useNotebooks();
  const { data: modules } = useModules();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NotebookSource | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");

  const active: Notebook | null = useMemo(() => {
    if (!notebooks || notebooks.length === 0) return null;
    return notebooks.find((n) => n.notebook_id === activeId) ?? notebooks[0];
  }, [notebooks, activeId]);

  const m = useNotebookMutations(active?.notebook_id);

  const shippedModules = useMemo(
    () => (modules ?? []).filter((x) => !x.track_key.startsWith("nb-")),
    [modules],
  );
  const shippedTopics = useMemo(
    () => shippedModules.reduce((n, x) => n + x.topic_count, 0),
    [shippedModules],
  );
  const shippedKeyed = useMemo(
    () => shippedModules.reduce((n, x) => n + x.ground_truth_topic_count, 0),
    [shippedModules],
  );

  const notebookModules = useMemo(() => {
    if (!active) return [];
    const ids = new Set(active.sources.map((s) => s.module_id));
    return (modules ?? []).filter((x) => ids.has(x.module_id));
  }, [modules, active]);

  /* A shared Library is read-only. The controls that would write to it are not
     rendered rather than rendered-and-refused: a disabled Remove still says the
     Candidate owns this material, and they do not. */
  const readOnly = active?.visibility === "shared";
  const ready = active?.sources.filter((s) => s.state === "ready") ?? [];
  const stubs = active?.sources.filter((s) => s.state === "stub") ?? [];
  const failed = active?.sources.filter((s) => s.state === "failed") ?? [];
  const namedTopics = notebookModules.reduce((n, x) => n + x.topic_count, 0);
  const keyedTopics = notebookModules.reduce((n, x) => n + x.ground_truth_topic_count, 0);

  if (error) {
    return (
      <>
        <PageHeader title="Notebook" />
        <Workbench><ErrorState title="Your notebooks could not be read" message={(error as Error).message} /></Workbench>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Notebook"
        sub={active ? `${active.embedding_model}` : undefined}
      >
        {active ? (
          <Tag tone={namedTopics > 0 ? "ok" : "neutral"}>
            {namedTopics > 0 ? `${namedTopics} Topics named` : "Nothing named yet"}
          </Tag>
        ) : null}
      </PageHeader>

      <Workbench
        side={
          <>
            <div>
              <span className="eyebrow">Adapter pipeline</span>
              <ul className="pipe mt-5">
                <PipeStep
                  done={ready.length > 0}
                  active={m.addFiles.isPending}
                  label="Chunk and embed"
                  value={ready.length === 0 ? "waiting" : `${ready.length} source${ready.length === 1 ? "" : "s"}`}
                />
                <PipeStep
                  done={notebookModules.length > 0}
                  label="Cluster into Modules"
                  value={notebookModules.length === 0 ? "pending" : `${notebookModules.length} Modules`}
                />
                <PipeStep
                  done={namedTopics > 0}
                  label="Name Topics"
                  value={namedTopics === 0 ? "pending" : `${namedTopics} Topics`}
                />
                <PipeStep
                  done={keyedTopics > 0}
                  label="Mine Ground Truth"
                  value={keyedTopics === 0 ? "none found" : `${keyedTopics} keyed`}
                />
              </ul>
              <p className="caption mt-5">
                Nothing is examinable until Topics are named. A Source that carried no readable text becomes a
                stub — listed, with its reason, rather than silently dropped.
              </p>
            </div>

            <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
              <span className="eyebrow">The contract</span>
              <dl className="judge-in mt-4">
                <dt>chunk()</dt><dd>char-addressed spans</dd>
                <dt>embed()</dt><dd>{active?.embedding_model ?? "—"}</dd>
                <dt>cluster()</dt><dd>Modules → Topics</dd>
                <dt>mine()</dt><dd>Q/A pairs as Ground Truth</dd>
                <dt>cite()</dt><dd>the exact span per question</dd>
              </dl>
              <p className="caption mt-5">
                The examination engine sees only this contract. Swapping the corpus changes nothing downstream.
              </p>
            </div>

            <Panel tone="2" pad={6} className="stack g-4">
              <span className="eyebrow">Cost</span>
              <CostUnknown>Examination cost — not knowable until you set scope.</CostUnknown>
              <p className="caption" style={{ margin: 0 }}>
                Ingest is metered on the same ledger a Session is. It begins when a Source is added, and it is
                refused rather than quoted if the balance cannot cover it.
              </p>
            </Panel>

            <ButtonLink
              to="/session/new"
              variant="primary"
              size="lg"
              full
              disabled={namedTopics === 0 && shippedTopics === 0}
              title={namedTopics === 0 ? "Available once Topics are named" : undefined}
            >
              Set scope &amp; duration
            </ButtonLink>
            <p className="caption" style={{ textAlign: "center", margin: 0 }}>
              {namedTopics > 0
                ? "Your notebook and the shipped course are scoped the same way."
                : shippedTopics > 0
                  ? "Your notebook has no named Topics yet — the shipped course is examinable now."
                  : "Available once the Adapter has named Topics."}
            </p>
          </>
        }
      >
        <p className="eyebrow">The corpus</p>
        <h1 className="display-3 mt-4">Your own notebook, the same examination.</h1>
        <p className="prose mt-6">
          The engine is corpus-agnostic behind an Adapter contract. Drop in what you have read — the Adapter
          chunks, embeds and clusters it into Modules and Topics, mines whatever question-and-answer material
          is already there as Ground Truth, and hands you the identical examination the shipped course gets.
        </p>

        <div className="door mt-9">
          <div className="door-card">
            <span className="eyebrow">Door one</span>
            <strong className="h3">The shipped course</strong>
            <p className="body-sm dim" style={{ margin: 0 }}>
              {shippedModules.length} Modules · {shippedTopics} Topics
              {shippedKeyed > 0 ? ` · ${shippedKeyed} with an Answer Key` : " · no Answer Keys"}. Keys make
              grading authoritative.
            </p>
            <span><Tag tone="ok">Connected</Tag></span>
          </div>
          <div className="door-card" data-active={active ? "" : undefined}>
            <span className="eyebrow">Door two</span>
            <strong className="h3">Your notebook</strong>
            <p className="body-sm dim" style={{ margin: 0 }}>
              PDFs, notes, saved pages. Same backbone, same Topic Visits, evidence weighted by what keys exist.
            </p>
            <span>
              <Tag tone={namedTopics > 0 ? "accent" : "neutral"}>
                {active ? (namedTopics > 0 ? "Examinable" : "Awaiting material") : "Not started"}
              </Tag>
            </span>
          </div>
        </div>

        <section className="mt-11" aria-labelledby="material">
          <SectionHead
            title="Material"
            aside={
              active
                ? `${active.sources.length} source${active.sources.length === 1 ? "" : "s"}`
                : "No notebook yet"
            }
          />

          {isPending ? (
            <SkeletonLines count={3} label="Reading your notebooks" />
          ) : !active ? (
            <EmptyState
              icon="notebook"
              title="You have no notebook yet"
              body="A notebook is a corpus you brought. Create one, and everything you drop into it becomes examinable the same way the shipped course is."
              action={
                <Button
                  variant="primary"
                  onClick={() => m.create.mutate("My notebook")}
                  loading={m.create.isPending}
                >
                  <Icon name="plus" size={14} />
                  Create a notebook
                </Button>
              }
            />
          ) : (
            <>
              {readOnly ? (
                <Panel tone="2" pad={6} className="rule-note">
                  <Icon name="info" size={16} />
                  <p className="body-sm dim" style={{ margin: 0 }}>
                    This Library was imported once and is shared with every Candidate. It is read-only, and
                    deliberately: the Topics in it are the join key for everybody&rsquo;s record, so removing
                    one would thin out other people&rsquo;s Evidence without saying so.
                  </p>
                </Panel>
              ) : (
                <Dropzone
                  onFiles={(files) => m.addFiles.mutate(files)}
                  disabled={false}
                  busy={m.addFiles.isPending}
                />
              )}

              <div className="row g-4 mt-5" style={{ flexWrap: "wrap" }}>
                {readOnly ? null : (
                  <Button variant="quiet" size="sm" onClick={() => setNoteOpen(true)}>
                    <Icon name="plus" size={14} />
                    Paste a note instead
                  </Button>
                )}
                {notebooks && notebooks.length > 1 ? (
                  <select
                    className="select"
                    style={{ width: "auto" }}
                    value={active.notebook_id}
                    aria-label="Which notebook"
                    onChange={(e) => setActiveId(e.target.value)}
                  >
                    {notebooks.map((n) => (
                      <option key={n.notebook_id} value={n.notebook_id}>
                        {n.visibility === "shared" ? `${n.title} (shared)` : n.title}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>

              {active.sources.length === 0 ? (
                <div className="mt-6">
                  <EmptyState
                    title="Nothing in this notebook yet"
                    body="The first Source you add is chunked and clustered on arrival. Ingest is metered, so it is refused rather than quoted if the balance cannot cover it."
                  />
                </div>
              ) : (
                <ul className="stack g-4 mt-6" style={{ listStyle: "none" }}>
                  {active.sources.map((s) => (
                    <li key={s.source_id}>
                      <div className="doc">
                        <span className="doc-icon" aria-hidden="true">{EXT_LABEL(s.title)}</span>
                        <span style={{ minWidth: 0 }}>
                          <span className="doc-name">{s.title}</span>
                          <span className="doc-meta">{docMeta(s)}</span>
                          {s.state === "ingesting" || s.state === "uploaded" ? (
                            <span className="stack g-2 mt-2" style={{ maxWidth: 260 }}>
                              {/* Work done against work found, never a spinner:
                                  forty seconds of spinner is indistinguishable
                                  from a hang, and which of the two it is happens
                                  to be the only thing the reader wants. */}
                              <Meter
                                value={s.progress_total > 0 ? s.progress_done / s.progress_total : 0}
                                label={`Reading ${s.title}`}
                              />
                              <span className="caption">
                                {s.progress_done} of {s.progress_total} sections
                                {s.since_progress_seconds !== null && s.since_progress_seconds > 20
                                  ? ` · nothing new for ${Math.round(s.since_progress_seconds)}s`
                                  : ""}
                              </span>
                            </span>
                          ) : null}
                        </span>
                        <span className="row g-4">
                          <Tag tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Tag>
                          {s.state === "failed" && !readOnly ? (
                            <Button
                              variant="quiet"
                              size="sm"
                              loading={m.retrySource.isPending}
                              onClick={() => m.retrySource.mutate({ sourceId: s.source_id, title: s.title })}
                            >
                              Retry
                            </Button>
                          ) : null}
                          {readOnly ? null : (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon
                              aria-label={`Remove ${s.title}`}
                              onClick={() => setPendingDelete(s)}
                            >
                              <Icon name="trash" size={14} />
                            </Button>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {failed.length > 0 ? (
                <Panel tone="2" pad={6} className="mt-6 rule-note" role="alert">
                  <Icon name="info" size={16} />
                  <p className="body-sm dim" style={{ margin: 0 }}>
                    {failed.length} document{failed.length === 1 ? "" : "s"} could not be read through to the
                    end. The upload survived it, so Retry re-embeds what is already stored rather than asking
                    you for the file again.
                  </p>
                </Panel>
              ) : null}

              {stubs.length > 0 ? (
                <Panel tone="2" pad={6} className="mt-6 rule-note">
                  <Icon name="info" size={16} />
                  <p className="body-sm dim" style={{ margin: 0 }}>
                    {stubs.length} source{stubs.length === 1 ? "" : "s"} carried no readable text — a scan, or
                    a malformed file. They are listed rather than hidden, because Coverage should measure what
                    you uploaded and not what happened to parse. They never reach the embedder, so they cost
                    nothing.
                  </p>
                </Panel>
              ) : null}
            </>
          )}
        </section>

        {active && notebookModules.length > 0 ? (
          <section className="mt-11" aria-labelledby="found">
            <SectionHead title="What the Adapter found" aside="Clusters become Modules · members become Topics" />
            <Panel pad={6}>
              <ul style={{ listStyle: "none" }}>
                {notebookModules.map((mod) => (
                  <li key={mod.module_id} className="cluster">
                    <span className="module-idx">{String(mod.order + 1).padStart(2, "0")}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="body-sm" style={{ color: "var(--fg)" }}>{mod.title}</span>
                      <span className="caption" style={{ display: "block" }}>
                        {mod.topic_count} Topic{mod.topic_count === 1 ? "" : "s"}
                        {mod.ground_truth_topic_count > 0
                          ? ` · ${mod.ground_truth_topic_count} with a mined Answer Key`
                          : " · no Answer Key found"}
                      </span>
                    </span>
                    <Tag tone={mod.ground_truth_topic_count > 0 ? "ok" : "neutral"}>
                      {mod.ground_truth_topic_count > 0 ? "Full weight" : "Reduced weight"}
                    </Tag>
                  </li>
                ))}
              </ul>
            </Panel>
            <p className="caption mt-4">
              Missing Answer Keys lower the weight of your evidence. They never make material unusable — and
              the Mastery figure a low-weight Topic reaches says, on its own row, what it was built from.
            </p>
          </section>
        ) : null}
      </Workbench>

      <Dialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={`Remove ${pendingDelete?.title ?? "this source"}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Keep it</Button>
            <Button
              variant="danger"
              data-autofocus
              loading={m.removeSource.isPending}
              onClick={() => {
                if (pendingDelete) {
                  m.removeSource.mutate({ sourceId: pendingDelete.source_id, title: pendingDelete.title });
                }
                setPendingDelete(null);
              }}
            >
              Remove the source
            </Button>
          </>
        }
      >
        Its Topics retire and stop being examinable. Every Evidence row they already produced stays on the
        record — the Evidence outlives the material, and deleting the source does not delete what you proved.
      </Dialog>

      <Dialog
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Paste a note"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              data-autofocus
              disabled={noteTitle.trim().length === 0 || noteText.trim().length === 0}
              loading={m.addText.isPending}
              onClick={() => {
                m.addText.mutate({ title: noteTitle.trim(), text: noteText });
                setNoteOpen(false);
                setNoteTitle("");
                setNoteText("");
              }}
            >
              Ingest it
            </Button>
          </>
        }
      >
        <div className="stack g-6">
          <TextField
            label="Title"
            placeholder="Week 6 — attention and masking"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
          />
          <TextAreaField
            label="The note"
            placeholder="Paste markdown or plain text."
            value={noteText}
            rows={8}
            onChange={(e) => setNoteText(e.target.value)}
            hint="Ingest is metered on the same ledger a Session is, and begins as soon as you confirm."
          />
        </div>
      </Dialog>
    </>
  );
}

function PipeStep({ done, active, label, value }: {
  done: boolean;
  active?: boolean;
  label: string;
  value: string;
}) {
  const state = active ? "active" : done ? "done" : undefined;
  return (
    <li className="pipe-step" data-state={state}>
      <span className="pipe-mark">{done && !active ? <Icon name="check" size={9} strokeWidth={2.4} /> : null}</span>
      <span>{label}</span>
      <span className="mono caption">{value}</span>
    </li>
  );
}
