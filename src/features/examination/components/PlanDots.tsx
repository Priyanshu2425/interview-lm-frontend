import type { SessionPlan } from "@/shared/types";

/* Where this question sits in the plan.
   The old dots counted Visits *scored* — a quantity that no longer exists
   while a Session runs. Position in a fixed plan does, and it is known before
   the first question rather than accumulating as the Session goes. */
export function PlanDots({ plan, currentItemId }: {
  plan: SessionPlan;
  currentItemId: string | null;
}) {
  const asked = plan.items.filter((i) => i.state === "asked").length;
  const at = plan.items.findIndex((i) => i.plan_item_id === currentItemId);

  return (
    <span
      className="visits"
      role="img"
      aria-label={
        at >= 0
          ? `Question ${at + 1} of ${plan.items.length}`
          : `${asked} of ${plan.items.length} questions asked`
      }
    >
      {plan.items.map((item, i) => (
        <i
          key={item.plan_item_id}
          data-done={item.state === "asked" ? "" : undefined}
          data-current={i === at ? "" : undefined}
        />
      ))}
    </span>
  );
}
