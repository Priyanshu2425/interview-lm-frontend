import type { PlanItem, PlanItemState, SessionPlan } from "@/shared/types";

/* The plan, as a list.
 *
 * There is no control on this component and there must never be one. The plan
 * is fixed before the first question and `trg_plan_item_fixed` refuses an
 * UPDATE of an item's Topics, order or focus — so a button here that offered
 * to reorder or skip would be offering something the database will not do.
 *
 * It renders in two places and is one component on purpose: the rail while the
 * Session runs, and the report after it ends. Two implementations would be two
 * chances for them to disagree about what was planned. */

const STATE_WORD: Record<PlanItemState, string> = {
  planned: "Not yet asked",
  asked: "Asked",
  unreached: "Never asked",
};

/* A label for every item, in a plan that may have no focus to show.
   The planner's fallback writes items with an empty `focus`, and a blank row
   is worse than a plain one — so the Topics say what the question was about,
   which is what the focus would have paraphrased. */
function labelOf(item: PlanItem): string {
  if (item.focus.trim()) return item.focus;
  const titles = item.topics.map((t) => t.title).filter(Boolean);
  return titles.length > 0 ? titles.join(" · ") : "This question's Topics are no longer in the Corpus";
}

export function PlanAgenda({ plan, currentItemId, variant = "rail" }: {
  plan: SessionPlan;
  currentItemId?: string | null;
  variant?: "rail" | "report";
}) {
  return (
    <ol className={`agenda agenda--${variant}`}>
      {/* Server order. Sorting here would be deciding something. */}
      {plan.items.map((item) => {
        const current = currentItemId != null && item.plan_item_id === currentItemId;
        return (
          <li
            key={item.plan_item_id}
            className="agenda-item"
            data-state={item.state}
            data-current={current ? "" : undefined}
            aria-current={current ? "step" : undefined}
          >
            <span className="agenda-n mono">{item.item_order + 1}</span>
            <div className="agenda-body">
              <p className="agenda-focus">{labelOf(item)}</p>
              <span className="agenda-topics">
                {item.topics.map((t) => (
                  <span key={t.topic_id} className="agenda-topic" data-reached={t.reached ? "" : undefined}>
                    {t.title || t.topic_id}
                  </span>
                ))}
              </span>
            </div>
            {/* The state in words, for anybody not reading the treatment. */}
            <span className="visually-hidden">
              {current ? "Being asked now. " : ""}{STATE_WORD[item.state]}.
            </span>
          </li>
        );
      })}
    </ol>
  );
}
