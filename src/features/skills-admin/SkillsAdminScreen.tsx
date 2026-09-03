import { useMemo, useState } from "react";
import { PageHeader, Workbench } from "@/shared/components";
import {
  Button, EmptyState, ErrorState, Icon, Panel, SectionHead, SkeletonLines, Switch, Tag, TextField,
} from "@/ui";
import { useOperatorAuth } from "@/features/operator/hooks/useOperator";
import { Dropzone } from "@/features/notebook/components/Dropzone";
import type { SharedSkillSummary, SourceState } from "@/shared/types";
import { useSharedSkill, useSharedSkills, useSkillsAdminMutations } from "./hooks/useSkillsAdmin";

const STATE_LABEL: Record<SourceState, string> = {
  uploaded: "Waiting",
  ingesting: "Reading",
  ready: "Ready",
  failed: "Failed",
  stub: "Unusable",
};

const STATE_TONE: Record<SourceState, "ok" | "risk" | "accent"> = {
  uploaded: "accent",
  ingesting: "accent",
  ready: "ok",
  failed: "risk",
  stub: "risk",
};

export function SkillsAdminScreen() {
  const token = useOperatorAuth((s) => s.token);
  const setToken = useOperatorAuth((s) => s.setToken);
  const clear = useOperatorAuth((s) => s.clear);
  const [draft, setDraft] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: skills, isPending, error } = useSharedSkills(token);
  const active: SharedSkillSummary | null = useMemo(() => {
    if (!skills || skills.length === 0) return null;
    return skills.find((s) => s.notebook_id === activeId) ?? skills[0];
  }, [skills, activeId]);

  const { data: detail } = useSharedSkill(token, active?.notebook_id);
  const { createSkill, uploadFiles, toggleActive } = useSkillsAdminMutations(token, active?.notebook_id);

  if (!token) return <TokenGate value={draft} onChange={setDraft} onSubmit={() => setToken(draft.trim())} />;

  if (error) {
    return (
      <>
        <PageHeader title="Skills" />
        <Workbench narrow>
          <ErrorState
            title="The console refused that token"
            message={error.message}
            action={<Button variant="secondary" onClick={clear}>Enter a different token</Button>}
          />
        </Workbench>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Skills" sub="Shared material every Candidate studies from">
        <Button variant="ghost" size="sm" onClick={clear}>Sign out</Button>
      </PageHeader>

      <Workbench
        side={
          <>
            <span className="eyebrow">New Skill</span>
            <form
              className="stack g-4 mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                const title = newTitle.trim();
                if (!title) return;
                createSkill.mutate(title, { onSuccess: (r) => setActiveId(r.notebook_id) });
                setNewTitle("");
              }}
            >
              <TextField
                label="Title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Data Structures"
              />
              <Button
                variant="primary"
                type="submit"
                size="sm"
                disabled={newTitle.trim().length === 0}
                loading={createSkill.isPending}
              >
                Create
              </Button>
            </form>
            <div className="hair-t mt-8" style={{ paddingTop: "var(--s-6)" }}>
              <span className="eyebrow">Disabling a Skill</span>
              <p className="caption mt-4">
                Takes it out of discovery — it stops appearing for new Sessions. Evidence a Candidate already
                earned against it stays fully on the record.
              </p>
            </div>
          </>
        }
      >
        {isPending ? (
          <SkeletonLines count={6} label="Reading shared Skills" />
        ) : !skills || skills.length === 0 ? (
          <EmptyState
            icon="notebook"
            title="No shared Skill yet"
            body="Create one to the side, then drop files onto it below."
          />
        ) : (
          <>
            <section aria-labelledby="skills-list">
              <SectionHead title="Shared Skills" aside={`${skills.length} total`} />
              <Panel style={{ overflow: "hidden" }}>
                <div className="table-scroll">
                  <table className="table">
                    <caption className="visually-hidden">Every shared Skill, its state and source counts.</caption>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th className="n">Sources</th>
                        <th className="n">Ready</th>
                        <th className="n">Reading</th>
                        <th className="n">Failed</th>
                        <th>Status</th>
                        <th aria-hidden="true"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {skills.map((s) => (
                        <tr
                          key={s.notebook_id}
                          data-active={s.notebook_id === active?.notebook_id ? "" : undefined}
                          style={{ cursor: "pointer" }}
                          onClick={() => setActiveId(s.notebook_id)}
                        >
                          <td><span style={{ color: "var(--fg)" }}>{s.title}</span></td>
                          <td className="n">{s.source_count}</td>
                          <td className="n">{s.states.ready}</td>
                          <td className="n">{s.states.uploaded + s.states.ingesting}</td>
                          <td className="n" style={{ color: s.states.failed > 0 ? "var(--risk)" : undefined }}>
                            {s.states.failed}
                          </td>
                          <td>
                            {s.active ? <Tag tone="ok">Active</Tag> : <Tag tone="risk">Disabled</Tag>}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <Switch
                              checked={s.active}
                              disabled={toggleActive.isPending}
                              onChange={(checked) =>
                                toggleActive.mutate({ id: s.notebook_id, active: checked })
                              }
                            >
                              <span className="visually-hidden">
                                {s.active ? `Disable ${s.title}` : `Enable ${s.title}`}
                              </span>
                            </Switch>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </section>

            {active ? (
              <section className="mt-11" aria-labelledby="skill-detail">
                <SectionHead
                  title={active.title}
                  aside={active.active ? "Discoverable" : "Not discoverable"}
                />

                <Dropzone
                  onFiles={(files) => uploadFiles.mutate(files)}
                  disabled={false}
                  busy={uploadFiles.isPending}
                />

                {detail && detail.sources.length > 0 ? (
                  <Panel style={{ overflow: "hidden" }} className="mt-6">
                    <div className="table-scroll">
                      <table className="table">
                        <caption className="visually-hidden">Every Source in this Skill and its ingest state.</caption>
                        <thead>
                          <tr>
                            <th>Document</th>
                            <th>State</th>
                            <th className="n">Progress</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.sources.map((src) => (
                            <tr key={src.source_id}>
                              <td><span style={{ color: "var(--fg)" }}>{src.title}</span></td>
                              <td>
                                <Tag tone={STATE_TONE[src.state]}>{STATE_LABEL[src.state]}</Tag>
                                {src.state === "stub" || src.state === "failed" ? (
                                  <span className="caption dim ml-4">{src.stub_reason ?? ""}</span>
                                ) : null}
                              </td>
                              <td className="n">
                                {src.progress_total > 0
                                  ? `${src.progress_done} / ${src.progress_total}`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                ) : (
                  <EmptyState
                    icon="source"
                    title="No document yet"
                    body="Drop a PDF, note or saved page above to start reading it in."
                    action={<Icon name="upload" size={18} />}
                  />
                )}
              </section>
            ) : null}
          </>
        )}
      </Workbench>
    </>
  );
}

function TokenGate({ value, onChange, onSubmit }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <PageHeader title="Skills" sub="Authenticated separately from Candidate access" />
      <Workbench narrow>
        <div style={{ maxWidth: "44ch" }}>
          <p className="eyebrow">Internal</p>
          <h1 className="display-3 mt-4">This dashboard is not yours by default.</h1>
          <p className="prose mt-6">
            The same operator token as the metering console — enter it once and both are open for this tab.
          </p>
          <form
            className="stack g-6 mt-9"
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          >
            <TextField
              label="Operator token"
              mono
              type="password"
              autoComplete="off"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              hint="Sent as x-operator-token on every read. Nothing is cached across tabs."
            />
            <Button variant="primary" type="submit" disabled={value.trim().length === 0}>
              Open Skills
            </Button>
          </form>
        </div>
      </Workbench>
    </>
  );
}
