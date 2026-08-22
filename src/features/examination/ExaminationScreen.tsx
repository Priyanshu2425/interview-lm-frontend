import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Workbench } from "@/shared/components";
import {
  Button, ButtonLink, CostValue, Dialog, EmptyState, ErrorState, Icon, Panel, SkeletonLines,
  TabPanel, Tabs, Tag,
} from "@/ui";
import type { TabItem } from "@/ui";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { usePreferenceStore } from "@/shared/stores/preferences";
import { useIsCompact, useReducedMotion } from "@/shared/hooks";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import { GRADING_MODE_LABEL, GRADING_MODE_WEIGHT } from "@/shared/utils/format";
import { useExamination } from "./hooks/useExamination";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import { GroundingPanel } from "./components/GroundingPanel";
import { ConfidencePanel } from "./components/ConfidencePanel";
import { JudgePanel } from "./components/JudgePanel";
import { SessionTimer, VisitDots } from "./components/SessionTimer";
import { SessionEndedNotice, SessionParkedNotice } from "./components/SessionOutcome";

type PaneKey = "grounding" | "confidence" | "judge";

const PANES: readonly TabItem<PaneKey>[] = [
  { key: "grounding", label: "Grounding" },
  { key: "confidence", label: "Confidence" },
  { key: "judge", label: "Judge" },
];

export function ExaminationScreen() {
  const { sessionId = "" } = useParams();
  const prefs = usePreferenceStore((s) => s.prefs);
  const stub = useSessionHistory((s) => s.sessions.find((x) => x.id === sessionId) ?? null);

  const exam = useExamination(sessionId);
  const [pane, setPane] = useState<PaneKey>(prefs.openGroundingFirst ? "grounding" : "confidence");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  const compactLabel = useIsCompact();
  const reducedMotion = useReducedMotion();

  const spend = useQuery({
    queryKey: queryKeys.session.spend(sessionId),
    queryFn: () => sessionService.spend(sessionId),
    enabled: Boolean(sessionId),
  });

  /* A closed Visit is the moment worth reading, so the panel follows it there
     rather than leaving the Candidate to find it. Adjusted during render:
     the Judge tab should be the one showing in the frame the score appears
     in, not the one after. */
  const [seenVisit, setSeenVisit] = useState(exam.lastVisit);
  if (seenVisit !== exam.lastVisit) {
    setSeenVisit(exam.lastVisit);
    if (exam.lastVisit) setPane("judge");
  }

  /* The composer is pinned to the foot of the stage, so anything appended
     lands underneath it until the transcript scrolls. Following the newest
     entry is what keeps the question you have to answer on screen. */
  const foot = useRef<HTMLDivElement>(null);
  const entryCount = exam.entries.length;
  useEffect(() => {
    if (entryCount === 0) return;
    foot.current?.scrollIntoView({
      block: "end",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [entryCount, reducedMotion]);


  const endSession = useCallback(async () => {
    setEnding(true);
    try {
      await sessionService.end(sessionId);
    } finally {
      setEnding(false);
      setConfirmEnd(false);
    }
  }, [sessionId]);

  if (!sessionId) return <NoSessionYet />;

  if (exam.loading) {
    return (
      <>
        <PageHeader title="Topic Visit" sub="Reading the Session" />
        <Workbench stage><SkeletonLines count={5} label="Reading the Session" /></Workbench>
      </>
    );
  }

  if (exam.loadError) {
    return (
      <>
        <PageHeader title="Examination" />
        <Workbench stage>
          <ErrorState
            title="That Session could not be read"
            message={exam.loadError}
            action={<ButtonLink to="/session/new" variant="primary">Start a new Session</ButtonLink>}
          />
        </Workbench>
      </>
    );
  }

  const current = exam.current;
  const topicTitle = current?.topic_title || exam.lastVisit?.topic_title;
  const composerDisabled = !current || Boolean(exam.ended) || Boolean(exam.parked);
  const betweenVisits = !current && !exam.ended && !exam.parked;

  return (
    <>
      <PageHeader
        eyebrow={current ? `Topic Visit ${exam.visitsScored + 1}` : "Session"}
        title={topicTitle || "Examination"}
      >
        <VisitDots scored={exam.visitsScored} total={Math.max(exam.visitsSeen, exam.visitsScored + 1)} />
        <SessionTimer startedAt={stub?.startedAt ?? null} durationSeconds={exam.durationSeconds} />
        {exam.ended ? (
          <ButtonLink to={`/evidence/${sessionId}`} variant="secondary" size="sm">Session record</ButtonLink>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (prefs.confirmBeforeEnding ? setConfirmEnd(true) : void endSession())}
          >
            {compactLabel ? "End" : "End Session"}
          </Button>
        )}
      </PageHeader>

      <Workbench
        stage
        side={
          <>
            <Tabs items={PANES} value={pane} onChange={setPane} label="About this question" />
            <TabPanel id="pane-grounding" active={pane === "grounding"}>
              <GroundingPanel
                citations={exam.lastVisit?.citations ?? []}
                mode={current?.grading_mode ?? exam.lastVisit?.grading_mode}
              />
            </TabPanel>
            <TabPanel id="pane-confidence" active={pane === "confidence"}>
              <ConfidencePanel visit={exam.lastVisit} topicTitle={topicTitle} />
            </TabPanel>
            <TabPanel id="pane-judge" active={pane === "judge"}>
              <JudgePanel visit={exam.lastVisit} />
            </TabPanel>

            <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
              <span className="eyebrow">This Session</span>
              <div className="mt-4">
                <CostValue
                  value={spend.data?.credits ?? null}
                  route={exam.paymentRoute}
                  unit="to date"
                />
              </div>
              <p className="caption mt-3">
                {exam.paymentRoute === "credits"
                  ? "One Credit is one US cent of provider cost, metered per graded call."
                  : "You are on your own key. The provider bills you directly and no Credits are spent."}
              </p>
            </div>
          </>
        }
      >
        {exam.parked ? (
          <SessionParkedNotice parked={exam.parked} onResume={exam.resume} resuming={exam.resuming} />
        ) : null}

        {/* On a phone the topbar carries only the title and two controls, so
            the Visit's position in the Session is restated here where there is
            room for it — the same move the mobile design makes. */}
        {current && compactLabel ? (
          <div className="exam-head">
            <div className="between" style={{ alignItems: "baseline" }}>
              <span className="eyebrow">Topic Visit {exam.visitsScored + 1}</span>
              <VisitDots
                scored={exam.visitsScored}
                total={Math.max(exam.visitsSeen, exam.visitsScored + 1)}
              />
            </div>
            <h1 className="h2">{topicTitle}</h1>
          </div>
        ) : null}

        {current ? (
          <div className="between exam-tags">
            <div className="row g-4" style={{ flexWrap: "wrap" }}>
              <Tag
                tone={current.grading_mode === "ground_truth" ? "ok" : "neutral"}
                title={`Evidence from this Visit is weighted ${GRADING_MODE_WEIGHT[current.grading_mode]}`}
              >
                {GRADING_MODE_LABEL[current.grading_mode]}
              </Tag>
              <Tag>weight {GRADING_MODE_WEIGHT[current.grading_mode]}</Tag>
            </div>
            <span className="caption">Opening question → follow-ups → probing → one score</span>
          </div>
        ) : null}

        <Transcript
          entries={exam.entries}
          thinking={exam.sending}
          resumedMidVisit={exam.resumedMidVisit}
          route={exam.paymentRoute}
          spend={spend.data}
          ended={Boolean(exam.ended)}
        />

        {/* Open, and between Topic Visits — the graph finished a Visit and
            stopped cleanly at the boundary, which is where a Session is meant
            to pause. Continuing is a deliberate act, never something that
            happens under the Candidate. */}
        {betweenVisits ? (
          <div className="mt-8">
            <Panel pad={7} className="stack g-6 outcome">
              <span className="eyebrow">Between Topic Visits</span>
              <h2 className="h3">
                {exam.lastVisit ? "That Topic is scored and on the record." : "This Session is open and waiting."}
              </h2>
              <p className="body-sm dim" style={{ margin: 0 }}>
                A Session pauses at a Topic boundary and never inside one. Opening the next Topic picks a
                Topic from the scope you set — the scheduler can tell an unasked Topic from a failed one,
                which is how it chooses.
              </p>
              <div className="row g-4" style={{ flexWrap: "wrap" }}>
                <Button
                  variant="primary"
                  onClick={exam.resume}
                  loading={exam.resuming}
                  loadingLabel="Opening the next Topic…"
                >
                  Open the next Topic
                </Button>
                <ButtonLink to={`/evidence/${sessionId}`} variant="ghost">
                  See what it has recorded
                </ButtonLink>
              </div>
            </Panel>
          </div>
        ) : null}

        {exam.ended ? (
          <div className="mt-8"><SessionEndedNotice ended={exam.ended} sessionId={sessionId} /></div>
        ) : null}

        {composerDisabled ? null : (
          <Composer
            disabled={composerDisabled}
            sending={exam.sending}
            onSubmit={exam.submit}
            error={exam.submitError}
            onRetry={exam.retry}
            footRef={foot}
          />
        )}
      </Workbench>

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End the Session after this Visit?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button variant="primary" data-autofocus onClick={endSession} loading={ending}>
              End after this Visit
            </Button>
          </>
        }
      >
        The Visit in progress is examined to the end and scored. A half-examined answer would corrupt the
        record this Session exists to build, so nothing stops mid-Visit — and you can resume from the next
        Topic later.
      </Dialog>
    </>
  );
}

function NoSessionYet() {
  const running = useSessionHistory((s) => s.sessions.find((x) => x.state === "running") ?? null);
  const recent = useSessionHistory((s) => s.sessions[0] ?? null);

  return (
    <>
      <PageHeader title="Examination" sub="The examination is the product" />
      <Workbench stage>
        {running ? (
          <EmptyState
            icon="resume"
            title="You have a Session still open"
            body="It is resumable exactly where it stopped — an interrupted Visit stays open until it is graded."
            action={
              <ButtonLink to={`/examination/${running.id}`} variant="primary">
                Resume it
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon="visit"
            title="No Session is running"
            body="Reading is not preparation. Choose a scope and a duration, and the examination begins on the first Topic the scheduler picks."
            action={
              <span className="row g-4">
                <ButtonLink to="/session/new" variant="primary">
                  <Icon name="scope" size={14} />
                  Set scope and duration
                </ButtonLink>
                {recent ? (
                  <ButtonLink to={`/evidence/${recent.id}`} variant="ghost">
                    Last Session record
                  </ButtonLink>
                ) : null}
              </span>
            }
          />
        )}
      </Workbench>
    </>
  );
}
