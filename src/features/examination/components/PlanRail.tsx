import type { PaymentRoute, SessionPlan, Spend } from "@/shared/types";
import { CostValue, EmptyState, SkeletonLines } from "@/ui";
import { PlanAgenda, PlanHeader } from "@/features/session-plan";

/* What is worth reading about a Session while it runs.
 *
 * The rail used to hold the grounding, the posterior and the Judge's reading.
 * None of the three exists mid-Session any more: the answer turn carries no
 * citations, nothing is graded until the end, and there is no per-question
 * score to show. What does exist — and is the thing fixing the plan bought —
 * is the plan itself, so that is what the rail is. */
export function PlanRail({ plan, loading, currentItemId, route, spend }: {
  plan: SessionPlan | undefined;
  loading: boolean;
  currentItemId: string | null;
  route: PaymentRoute;
  spend: Spend | undefined;
}) {
  return (
    <>
      {loading ? (
        <SkeletonLines count={5} label="Reading the plan" />
      ) : plan ? (
        <div className="stack g-6">
          <PlanHeader plan={plan} />
          <PlanAgenda plan={plan} currentItemId={currentItemId} />
        </div>
      ) : (
        /* A Session may honestly have no plan: MCP Mode's do not. */
        <EmptyState
          icon="source"
          title="This Session has no written plan"
          body="It was not started from the planner, so there is no agenda to show. The exchange is unaffected."
        />
      )}

      <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
        <span className="eyebrow">This Session</span>
        <div className="mt-4">
          <CostValue value={spend?.credits ?? null} route={route} unit="to date" />
        </div>
        {/* Planning on its own line. It was charged before the first question
            and folding it into the questions would hide a cost that was paid
            whatever else happened. */}
        <div className="mt-3">
          <CostValue value={spend?.planning ?? null} route={route} unit="to plan it" />
        </div>
        <p className="caption mt-3">
          {route === "credits"
            ? "One Credit is one US cent of provider cost, metered per model call. The Session is graded once, at the end."
            : "You are on your own key. The provider bills you directly and no Credits are spent."}
        </p>
      </div>
    </>
  );
}
