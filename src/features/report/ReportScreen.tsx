import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageHeader, Workbench } from "@/shared/components";
import {
  ButtonLink, EmptyState, ErrorState, Icon, Panel, SkeletonLines, TabPanel, Tabs,
} from "@/ui";
import type { TabItem } from "@/ui";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import { credits as fmtCredits, duration as fmtDuration } from "@/shared/utils/format";
import { endReason } from "@/shared/utils/reasons";
import { PlanAgenda, PlanHeader } from "@/features/session-plan";
import { useReport } from "./hooks/useReport";
import { TopicTable } from "./components/TopicTable";

type PaneKey = "plan" | "reached" | "unreached";

export function ReportScreen() {
  const { sessionId = "" } = useParams();
  const sessions = useSessionHistory((s) => s.sessions);

  /* Always one Session's report: `/report` on its own now sends you to the
     list it used to duplicate. */
  return <SessionReport sessionId={sessionId} known={sessions.some((s) => s.id === sessionId)} />;
}

function SessionReport({ sessionId, known }: { sessionId: string; known: boolean }) {
  const { loading, error, report, spend, rows } = useReport(sessionId);
  const [pane, setPane] = useState<PaneKey>("reached");

  if (error) {
    return (
      <>
        <PageHeader title="Report" />
        <Workbench>
          <ErrorState
            title="That Session's report could not be read"
            message={error}
            action={<ButtonLink to="/report" variant="secondary">Pick another Session</ButtonLink>}
          />
        </Workbench>
      </>
    );
  }

  const route = spend?.route ?? "credits";
  const plan = report?.plan ?? null;
  const unreached = report?.planned_not_reached ?? [];
  const parked = report?.state === "parked";
  const closing = endReason(report?.ended_reason);

  const panes: readonly TabItem<PaneKey>[] = [
    { key: "reached", label: `Reached (${rows.length})` },
    { key: "unreached", label: `Not reached (${unreached.length})` },
    ...(plan ? [{ key: "plan" as const, label: "The plan" }] : []),
  ];

  return (
    <>
      <PageHeader title="Report" sub={`Session ${sessionId}`}>
        <ButtonLink to="/mastery" variant="secondary" size="sm">Mastery map</ButtonLink>
      </PageHeader>

      <Workbench
        side={
          <>
            <span className="eyebrow">This Session</span>
            <dl className="judge-in">
              <dt>metered</dt><dd>{fmtCredits(spend?.credits ?? null, route)}</dd>
              {/* Planning is its own line. It was charged before the first
                  question and folding it into the questions would hide a cost
                  that was paid whatever else happened. */}
              <dt>planning</dt><dd>{fmtCredits(spend?.planning ?? null, route)}</dd>
              <dt>balance</dt><dd>{fmtCredits(spend?.balance ?? null, route)}</dd>
              <dt>ran for</dt><dd>{fmtDuration(report?.duration_seconds ?? 0)}</dd>
              <dt>provider</dt><dd>{report?.provider || "—"}</dd>
            </dl>
            <p className="caption">
              {route === "credits"
                ? "One Credit is one US cent of provider cost, metered per model call."
                : "You are on your own key. The provider bills you directly and no Credits are spent."}
            </p>
            <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
              <ButtonLink to={`/examination/${sessionId}`} variant="ghost" size="sm">
                <Icon name="resume" size={14} />
                Open this Session
              </ButtonLink>
            </div>
          </>
        }
      >
        {loading ? (
          <SkeletonLines count={6} label="Reading the Session report" />
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

            {/* Waiting is not over, and only a Session that is over is graded.
                A parked Session with an empty report would otherwise read as a
                Session that proved nothing. */}
            {parked ? (
              <Panel tone="2" pad={6} className="mt-0 rule-note">
                <Icon name="info" size={16} />
                <p className="body-sm dim" style={{ margin: 0 }}>
                  This Session is parked, not finished, so it has not been graded. Anything
                  below is from an earlier pass. Resuming carries it on.
                </p>
              </Panel>
            ) : null}

            <p className="eyebrow">The report</p>
            <h1 className="display-3 mt-4">{parked ? "Not finished yet." : closing.title}</h1>
            <p className="prose mt-6">
              {parked ? "This Session stopped partway and is waiting to be picked up." : closing.body}
            </p>
            <p className="prose mt-4">
              The Session is graded once, at the end, Topic by Topic, from what was actually
              said. There is no figure here for the Session as a whole — Coverage and Mastery
              are two readings of one Topic, and a Session is not a Topic.
            </p>

            <div className="mt-9">
              <Tabs items={panes} value={pane} onChange={setPane} label="This Session's report" />

              <TabPanel id="pane-reached" active={pane === "reached"}>
                <div className="mt-6">
                  <Panel style={{ overflow: "hidden" }}>
                    <TopicTable rows={rows} route={route} />
                  </Panel>
                  <p className="caption mt-4">
                    Open a row for the spans behind its questions, the two readings the Judge
                    took, and where the Topic stands now.
                  </p>
                </div>
              </TabPanel>

              {/* Names, and nothing else. There is no band, no interval and no
                  cell here that a zero could land in — an unreached Topic was
                  never measured, and untested is not zero. */}
              <TabPanel id="pane-unreached" active={pane === "unreached"}>
                <div className="mt-6">
                  {unreached.length === 0 ? (
                    <EmptyState
                      icon="ledger"
                      title="The plan was run to the end"
                      body="Every Topic it named was reached and measured."
                    />
                  ) : (
                    <>
                      <Panel>
                        <ul style={{ listStyle: "none" }}>
                          {unreached.map((t, i) => (
                            <li key={t.topic_id} className={`untested-row${i ? " hair-t" : ""}`}>
                              <span className="body-sm" style={{ color: "var(--fg)" }}>
                                {t.title || t.topic_id}
                              </span>
                              <span className="caption">Never asked</span>
                            </li>
                          ))}
                        </ul>
                      </Panel>
                      <p className="caption mt-4">
                        Planned, and the Session ran out before reaching them. They carry no reading
                        and no zero: nothing was asked, so nothing was measured. That is a fact about
                        this Session, not about you.
                      </p>
                    </>
                  )}
                </div>
              </TabPanel>

              {plan ? (
                <TabPanel id="pane-plan" active={pane === "plan"}>
                  <div className="mt-6 stack g-7">
                    <PlanHeader plan={plan} />
                    <Panel pad={7}>
                      <PlanAgenda plan={plan} variant="report" />
                    </Panel>
                    <p className="caption" style={{ margin: 0 }}>
                      Decided before the first question and unchanged since — the database refuses
                      to rewrite an item, so this is the plan the Session actually ran.
                    </p>
                  </div>
                </TabPanel>
              ) : null}
            </div>
          </>
        )}
      </Workbench>
    </>
  );
}
