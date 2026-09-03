import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Workbench } from "@/shared/components";
import {
  Button, ButtonLink, Dialog, ErrorState, Panel, SkeletonLines, Tag,
} from "@/ui";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { usePreferenceStore } from "@/shared/stores/preferences";
import { useIsCompact, useReducedMotion } from "@/shared/hooks";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import { GRADING_MODE_LABEL, GRADING_MODE_WEIGHT } from "@/shared/utils/format";
import { usePlan } from "@/features/session-plan";
import { useExamination } from "./hooks/useExamination";
import { Transcript } from "./components/Transcript";
import { Composer } from "./components/Composer";
import { PlanRail } from "./components/PlanRail";
import { PlanDots } from "./components/PlanDots";
import { SessionTimer } from "./components/SessionTimer";
import { SessionEndedNotice, SessionParkedNotice } from "./components/SessionOutcome";

export function ExaminationScreen() {
  const { sessionId = "" } = useParams();
  const prefs = usePreferenceStore((s) => s.prefs);
  const stub = useSessionHistory((s) => s.sessions.find((x) => x.id === sessionId) ?? null);

  const exam = useExamination(sessionId);
  const plan = usePlan(sessionId);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const compactLabel = useIsCompact();
  const reducedMotion = useReducedMotion();

  const spend = useQuery({
    queryKey: queryKeys.session.spend(sessionId),
    queryFn: () => sessionService.spend(sessionId),
    enabled: Boolean(sessionId),
  });

  /* The composer is pinned to the foot of the stage, so anything appended
     lands underneath it until the transcript scrolls. Following the newest
     turn is what keeps the question you have to answer on screen. */
  const foot = useRef<HTMLDivElement>(null);
  const turnCount = exam.turns.length;
  useEffect(() => {
    if (turnCount === 0) return;
    foot.current?.scrollIntoView({
      block: "end",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [turnCount, reducedMotion]);

  if (exam.loading) {
    return (
      <>
        <PageHeader title="Examination" sub="Reading the Session" />
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
  const spanned = exam.topicTitles;
  /* Every Topic the question spans. A compressed item spans up to three, and
     naming one of them would misdescribe what is being asked. */
  const asking = spanned.length > 0 ? spanned.join(" · ") : "";
  const composerDisabled = !current || Boolean(exam.ended) || Boolean(exam.parked);
  const betweenQuestions = !current && !exam.ended && !exam.parked;

  const at = plan.data?.items.findIndex((i) => i.plan_item_id === exam.planItemId) ?? -1;
  const position = plan.data && at >= 0
    ? `Question ${at + 1} of ${plan.data.items.length}`
    : "Session";

  const dots = plan.data
    ? <PlanDots plan={plan.data} currentItemId={exam.planItemId} />
    : null;

  return (
    <>
      <PageHeader
        eyebrow={current ? position : "Session"}
        title={asking || "Examination"}
      >
        {dots}
        <SessionTimer startedAt={stub?.startedAt ?? null} durationSeconds={exam.durationSeconds} />
        {exam.ended ? (
          <ButtonLink to={`/report/${sessionId}`} variant="secondary" size="sm">Report</ButtonLink>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (prefs.confirmBeforeEnding ? setConfirmEnd(true) : exam.end())}
          >
            {compactLabel ? "End" : "End Session"}
          </Button>
        )}
      </PageHeader>

      <Workbench
        stage
        side={
          <PlanRail
            plan={plan.data}
            loading={plan.isPending}
            currentItemId={exam.planItemId}
            route={exam.paymentRoute}
            spend={spend.data}
          />
        }
      >
        {exam.parked ? (
          <SessionParkedNotice parked={exam.parked} onResume={exam.resume} resuming={exam.resuming} />
        ) : null}

        {/* On a phone the topbar carries only the title and two controls, so
            the question's position in the plan is restated here where there is
            room for it — the same move the mobile design makes. */}
        {current && compactLabel ? (
          <div className="exam-head">
            <div className="between" style={{ alignItems: "baseline" }}>
              <span className="eyebrow">{position}</span>
              {dots}
            </div>
            {/* Not a second heading: the topbar carries the page's h1 on every
                width, and this restates it where a phone has room. */}
            <p className="h2" style={{ margin: 0 }}>{asking}</p>
          </div>
        ) : null}

        {current ? (
          <div className="between exam-tags">
            <div className="row g-4" style={{ flexWrap: "wrap" }}>
              <Tag
                tone={current.grading_mode === "ground_truth" ? "ok" : "neutral"}
                title={`Evidence from this Topic is weighted ${GRADING_MODE_WEIGHT[current.grading_mode]}`}
              >
                {GRADING_MODE_LABEL[current.grading_mode]}
              </Tag>
              <Tag>weight {GRADING_MODE_WEIGHT[current.grading_mode]}</Tag>
            </div>
            <span className="caption">Question → follow-ups → probing. Graded once, at the end.</span>
          </div>
        ) : null}

        <Transcript
          turns={exam.turns}
          thinking={exam.sending}
          resumedMidQuestion={exam.resumedMidQuestion}
        />

        {/* Open, and between questions — the graph finished one and stopped
            cleanly at the boundary, which is where a Session is meant to
            pause. Continuing is a deliberate act, never something that
            happens under the Candidate. */}
        {betweenQuestions ? (
          <div className="mt-8">
            <Panel pad={7} className="stack g-6 outcome">
              <span className="eyebrow">Between questions</span>
              <h2 className="h3">This Session is open and waiting.</h2>
              <p className="body-sm dim" style={{ margin: 0 }}>
                A Session pauses between questions and never inside one. What comes next
                was decided before the first question was asked and has not changed —
                it is the next item on the plan.
              </p>
              <div className="row g-4" style={{ flexWrap: "wrap" }}>
                <Button
                  variant="primary"
                  onClick={exam.resume}
                  loading={exam.resuming}
                  loadingLabel="Opening the next question…"
                >
                  Ask the next question
                </Button>
              </div>
            </Panel>
          </div>
        ) : null}

        {exam.ended ? (
          <div className="mt-8">
            <SessionEndedNotice
              ended={exam.ended}
              sessionId={sessionId}
              graded={exam.gradedCount}
            />
          </div>
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
        title="End the Session after this question?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEnd(false)}>Keep going</Button>
            <Button
              variant="primary"
              data-autofocus
              loading={exam.ending}
              onClick={() => { exam.end(); setConfirmEnd(false); }}
            >
              End after this question
            </Button>
          </>
        }
      >
        The question being asked is examined to the end first. Then the whole Session is
        graded at once, Topic by Topic, from what was actually said — and anything the
        plan never reached is left unasked rather than scored zero.
      </Dialog>
    </>
  );
}
