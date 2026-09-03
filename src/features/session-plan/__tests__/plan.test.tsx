import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlanItem, SessionPlan } from "@/shared/types";
import { PlanAgenda } from "../components/PlanAgenda";
import { PlanHeader } from "../components/PlanHeader";

const item = (over: Partial<PlanItem> = {}): PlanItem => ({
  plan_item_id: "pi-1",
  item_order: 0,
  focus: "Derive the update rule and say where it comes from",
  state: "planned",
  topic_ids: ["t-1"],
  topics: [{ topic_id: "t-1", title: "Backpropagation", reached: false }],
  ...over,
});

const plan = (over: Partial<SessionPlan> = {}): SessionPlan => ({
  session_id: "s-1",
  budget_questions: 2,
  suggested_seconds: 2160,
  chosen_seconds: 1500,
  breadth: "full",
  planner_provider: "deepseek",
  planner_fallback: false,
  items: [item()],
  ...over,
});

describe("the plan is fixed", () => {
  /* `trg_plan_item_fixed` refuses an UPDATE of an item's Topics, order or
     focus. A control here would offer something the database will not do. */
  it("offers no control that could change it", () => {
    const { container } = render(<PlanAgenda plan={plan()} variant="report" />);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll("input, select, textarea")).toHaveLength(0);
  });

  it("renders items in the order the server sent them", () => {
    const p = plan({
      items: [
        item({ plan_item_id: "a", item_order: 0, focus: "First" }),
        item({ plan_item_id: "b", item_order: 1, focus: "Second" }),
      ],
    });
    const { container } = render(<PlanAgenda plan={p} />);
    const rows = [...container.querySelectorAll(".agenda-focus")].map((n) => n.textContent);
    expect(rows).toEqual(["First", "Second"]);
  });
});

describe("a plan built by rule", () => {
  /* The fallback is the record's only way to tell a plan a model wrote from
     one it did not. Hiding it makes the two indistinguishable. */
  it("says so, in words", () => {
    render(<PlanHeader plan={plan({ planner_fallback: true })} />);
    expect(screen.getByText(/built by rule/i)).toBeInTheDocument();
  });

  it("is silent about the planner when the model answered", () => {
    render(<PlanHeader plan={plan({ planner_fallback: false })} />);
    expect(screen.queryByText(/built by rule/i)).not.toBeInTheDocument();
  });

  /* A fallback plan carries no focus. A blank row is worse than a plain one,
     so the Topics say what the question was about. */
  it("labels an item with its Topics when it has no focus", () => {
    const p = plan({
      planner_fallback: true,
      items: [item({
        focus: "",
        topic_ids: ["t-1", "t-2"],
        topics: [
          { topic_id: "t-1", title: "Backpropagation", reached: true },
          { topic_id: "t-2", title: "Chain rule", reached: false },
        ],
      })],
    });
    const { container } = render(<PlanAgenda plan={p} />);
    const focus = container.querySelector(".agenda-focus");
    expect(focus?.textContent).toBe("Backpropagation · Chain rule");
    expect(focus?.textContent?.trim()).not.toBe("");
  });
});

describe("what a plan never says", () => {
  /* Compressed is a fact about the clock and the scope. Expressing it as a
     shortfall makes it a judgement about the Candidate. */
  it("describes compression without a percentage or the word reduced", () => {
    const { container } = render(<PlanHeader plan={plan({ breadth: "compressed" })} />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/group Topics/i);
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/reduced|partial|incomplete/i);
  });

  it("carries no reading of any kind against an item", () => {
    const { container } = render(
      <PlanAgenda plan={plan({ items: [item({ state: "unreached" })] })} variant="report" />,
    );
    /* An unreached item is named. It is never scored, and never zeroed. */
    expect(container.textContent).not.toMatch(/\d\.\d\d/);
    expect(container.querySelector(".reading")).toBeNull();
  });
});
