import type { SessionPlan } from "@/shared/types";
import { Icon, Tag } from "@/ui";
import { duration as fmtDuration } from "@/shared/utils/format";

const BREADTH_COPY: Record<SessionPlan["breadth"], string> = {
  full: "Every Topic in scope gets its own question.",
  compressed: "Questions group Topics, because the clock could not afford one each.",
};

/* What the plan is, before what is in it.
   `breadth` is a fact about the clock and the scope, never a judgement about
   the Candidate and never a shortfall expressed as a percentage. */
export function PlanHeader({ plan }: { plan: SessionPlan }) {
  return (
    <div className="stack g-5">
      <div className="between" style={{ alignItems: "baseline" }}>
        <span className="eyebrow">The plan</span>
        <span className="mono body-sm">
          {plan.budget_questions} question{plan.budget_questions === 1 ? "" : "s"}
        </span>
      </div>

      <p className="caption" style={{ margin: 0 }}>
        {BREADTH_COPY[plan.breadth]} Fixed before the first question was asked, and
        unchanged since.
      </p>

      <div className="row g-4" style={{ flexWrap: "wrap" }}>
        <Tag>{fmtDuration(plan.chosen_seconds)} chosen</Tag>
        {plan.suggested_seconds !== plan.chosen_seconds ? (
          <Tag>{fmtDuration(plan.suggested_seconds)} suggested</Tag>
        ) : null}
        {plan.planner_provider ? <Tag>{plan.planner_provider}</Tag> : null}
      </div>

      {/* Always shown, never as an error. A plan built by rule is still fixed
          and still runs — hiding it would make it indistinguishable from one
          a model wrote, which is the whole reason the flag is recorded. */}
      {plan.planner_fallback ? (
        <p className="caption row g-4" style={{ margin: 0, alignItems: "flex-start" }}>
          <Icon name="info" size={14} />
          <span>
            The planner did not answer, so this plan was built by rule. It is fixed
            and it runs exactly the same; it just was not written by a model.
          </span>
        </p>
      ) : null}
    </div>
  );
}
