import { useParams } from "react-router-dom";
import { PageHeader, Workbench } from "@/shared/components";
import {
  ButtonLink, EmptyState, ErrorState, Icon, Panel, SkeletonLines, Stat,
} from "@/ui";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import { credits as fmtCredits, duration as fmtDuration, relativeTime } from "@/shared/utils/format";
import { useSessionRecord } from "./hooks/useSessionRecord";
import { EvidenceTable } from "./components/EvidenceTable";

export function EvidenceScreen() {
  const { sessionId } = useParams();
  const sessions = useSessionHistory((s) => s.sessions);

  if (!sessionId) return <PickASession />;

  return <SessionRecord sessionId={sessionId} known={sessions.some((s) => s.id === sessionId)} />;
}

function SessionRecord({ sessionId, known }: { sessionId: string; known: boolean }) {
  const { loading, error, summary, spend, rows } = useSessionRecord(sessionId);

  if (error) {
    return (
      <>
        <PageHeader title="Evidence" />
        <Workbench>
          <ErrorState
            title="That Session record could not be read"
            message={error}
            action={<ButtonLink to="/evidence" variant="secondary">Pick another Session</ButtonLink>}
          />
        </Workbench>
      </>
    );
  }

  const route = spend?.route ?? "credits";
  const coverage = summary?.coverage;
  const mastery = summary?.mastery;

  return (
    <>
      <PageHeader title="Evidence" sub={`Session ${sessionId}`}>
        <ButtonLink to="/mastery" variant="secondary" size="sm">Mastery map</ButtonLink>
      </PageHeader>

      <Workbench
        side={
          <>
            <span className="eyebrow">How this Session was graded</span>
            <div className="stack g-5">
              <div className="between">
                <span className="body-sm dim">Against an Answer Key</span>
                <strong className="mono">{summary?.ground_truth_visits ?? "—"}</strong>
              </div>
              <div className="between">
                <span className="body-sm dim">From the course text</span>
                <strong className="mono">{summary?.text_grounded_visits ?? "—"}</strong>
              </div>
              <div className="between">
                <span className="body-sm dim">On model judgment</span>
                <strong className="mono">{summary?.model_judgment_visits ?? "—"}</strong>
              </div>
            </div>
            <p className="caption">
              Weighted 1.00, 0.70 and 0.50. A missing Answer Key lowers the weight of the evidence and never
              makes the material unusable — and the reason travels with the row.
            </p>

            <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
              <span className="eyebrow">Metered</span>
              <div className="stack g-5 mt-4">
                <div className="between">
                  <span className="body-sm dim">This Session</span>
                  <strong className="mono">{fmtCredits(spend?.credits ?? null, route)}</strong>
                </div>
                <div className="between">
                  <span className="body-sm dim">Balance after</span>
                  <strong className="mono">{fmtCredits(spend?.balance ?? null, route)}</strong>
                </div>
              </div>
              <p className="caption mt-5">
                {route === "credits"
                  ? "Real cents, summed from provider receipts. Nothing here is estimated."
                  : "You are on your own key. The provider billed you directly, and no Credits were spent."}
              </p>
            </div>

            <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
              <span className="eyebrow">Session</span>
              <dl className="judge-in mt-4">
                <dt>duration</dt><dd>{summary ? fmtDuration(summary.duration_seconds) : "—"}</dd>
                <dt>provider</dt><dd>{summary?.provider ?? "—"}</dd>
                <dt>id</dt><dd className="mono">{sessionId}</dd>
              </dl>
            </div>

            <ButtonLink to={`/examination/${sessionId}`} variant="secondary" full>
              <Icon name="resume" size={14} />
              Open this Session
            </ButtonLink>
          </>
        }
      >
        {loading ? (
          <SkeletonLines count={6} label="Reading the Session record" />
        ) : (
          <>
            {known ? null : (
              <Panel tone="2" pad={6} className="mt-0 rule-note">
                <Icon name="info" size={16} />
                <p className="body-sm dim" style={{ margin: 0 }}>
                  This Session was not started in this browser. It is read from the server, which is where the
                  record actually lives.
                </p>
              </Panel>
            )}

            <p className="eyebrow">The record</p>
            <h1 className="display-3 mt-4">What this Session can prove.</h1>
            <p className="prose mt-6">
              One row per Topic Visit — the unit of evidence. Each carries how it was graded, what grounded it,
              and what it cost, because a score with no provenance is not a score worth keeping.
            </p>

            {/* Coverage and Mastery, reported separately. Nothing on this
                screen merges them. */}
            <div className="grid-4 readings-row mt-9">
              <Stat
                label="Topics examined"
                value={summary?.topics_examined ?? "—"}
                note="Visits that closed and were graded."
              />
              <Stat
                label="Coverage"
                value={coverage?.topics_examined ?? "—"}
                unit={coverage ? `/ ${coverage.topics_total}` : undefined}
                note="Topics with evidence, across the whole corpus."
              />
              <Stat
                label="Looks solid"
                value={mastery?.looks_solid ?? "—"}
                note="Firm enough to say so, among those on record."
              />
              <Stat
                label="Metered"
                value={fmtCredits(spend?.credits ?? null, route)}
                note={route === "credits" ? "Real cents from provider receipts." : "You are on your own key."}
              />
            </div>

            <section className="mt-9" aria-labelledby="rows">
              <div className="section-head">
                <h2 className="h2" id="rows">Evidence rows</h2>
                <span className="caption">Open a row for the grounding behind it</span>
              </div>
              <Panel style={{ overflow: "hidden" }}>
                <EvidenceTable rows={rows} route={route} />
              </Panel>
            </section>

            {summary && summary.untested_modules.length > 0 ? (
              <section className="mt-11" aria-labelledby="not-asked">
                <div className="section-head">
                  <h2 className="h2" id="not-asked">And what it could not</h2>
                  <span className="caption">
                    {summary.untested_modules.reduce((n, m) => n + m.topics_untested, 0)} Topics never asked about
                  </span>
                </div>
                <Panel>
                  <ul style={{ listStyle: "none" }}>
                    {summary.untested_modules.map((m, i) => (
                      <li key={m.module_id} className={`untested-row${i ? " hair-t" : ""}`}>
                        <span>
                          <span className="body-sm" style={{ color: "var(--fg)" }}>{m.title}</span>
                          <span className="caption" style={{ display: "block", marginTop: "var(--s-2)" }}>
                            {m.has_ground_truth
                              ? "Carries an Answer Key — evidence from here would count at full weight."
                              : "No Answer Key in this material. Still examinable, at a lower weight."}
                          </span>
                        </span>
                        <span className="untested-count">
                          <strong className="mono">{m.topics_untested}</strong>
                          <span className="caption"> / {m.topics_total}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <p className="caption mt-4">
                  Untested is not zero. These Topics have no reading because nobody has asked, which is a
                  different fact from a low one — and the only one of the two you can fix by starting a Session.
                </p>
              </section>
            ) : null}
          </>
        )}
      </Workbench>
    </>
  );
}

function PickASession() {
  const sessions = useSessionHistory((s) => s.sessions);
  return (
    <>
      <PageHeader title="Evidence" sub="One record per Session" />
      <Workbench narrow>
        <p className="eyebrow">The permanent record</p>
        <h1 className="display-3 mt-4">Every Session leaves one.</h1>
        <p className="prose mt-6">
          Evidence outlives the material it came from. A Session record carries what was asked, how it was
          graded, what grounded it and what it cost — and it survives the notebook being deleted.
        </p>

        {sessions.length === 0 ? (
          <div className="mt-9">
            <EmptyState
              icon="ledger"
              title="No Session has run in this browser yet"
              body="Records are held on the server, but the id is the handle on one — and this browser has not seen a Session to remember."
              action={<ButtonLink to="/session/new" variant="primary">Start a Session</ButtonLink>}
            />
          </div>
        ) : (
          <Panel className="mt-9">
            <ul style={{ listStyle: "none" }}>
              {sessions.map((s, i) => (
                <li key={s.id} className={`session-row${i ? " hair-t" : ""}`}>
                  <span>
                    <span className="body-sm" style={{ color: "var(--fg)" }}>
                      {s.moduleCount} Module{s.moduleCount === 1 ? "" : "s"} · {fmtDuration(s.durationSeconds)}
                    </span>
                    <span className="caption" style={{ display: "block", marginTop: "var(--s-2)" }}>
                      <span className="mono">{s.id}</span> · started {relativeTime(new Date(s.startedAt).toISOString())}
                    </span>
                  </span>
                  <span className="row g-4">
                    {s.state === "running" ? (
                      <ButtonLink to={`/examination/${s.id}`} variant="ghost" size="sm">Resume</ButtonLink>
                    ) : null}
                    <ButtonLink to={`/evidence/${s.id}`} variant="secondary" size="sm">Record</ButtonLink>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Workbench>
    </>
  );
}
