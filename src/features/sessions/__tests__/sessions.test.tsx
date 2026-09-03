import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SessionListing } from "@/shared/types";
import { SessionTable } from "../components/SessionTable";
import { OpenSessionCard } from "../components/OpenSessionCard";
import { openSession } from "../hooks/useSessions";

const session = (over: Partial<SessionListing> = {}): SessionListing => ({
  session_id: "ses_1",
  state: "ended",
  started_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  ended_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  duration_seconds: 1500,
  provider: "deepseek",
  payment_route: "credits",
  module_ids: ["m-1"],
  ended_reason: "plan_exhausted",
  parked_reason: null,
  budget_questions: 5,
  questions_asked: 5,
  topics_measured: 4,
  ...over,
});

const scopeOf = () => "Backpropagation";
const table = (sessions: SessionListing[]) =>
  render(<MemoryRouter><SessionTable sessions={sessions} scopeOf={scopeOf} /></MemoryRouter>);

describe("a Session has no reading, and the list must not invent one", () => {
  it("carries no score, percentage or band anywhere", () => {
    const { container } = table([
      session(),
      session({ session_id: "ses_2", state: "parked", parked_reason: "credits_exhausted",
                ended_reason: null, questions_asked: 2, topics_measured: 0 }),
    ]);
    expect(container.textContent).not.toMatch(/\d\.\d\d/);
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/\b(score|mastery|overall|grade)\b/i);
  });

  it("reports Topics measured as a count, beside what it is", () => {
    table([session({ topics_measured: 4 })]);
    expect(screen.getByText("Topics measured")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

describe("the three states are three different facts", () => {
  it("says a parked Session has not been graded, rather than showing nothing", () => {
    /* A dash where every other row has a fact reads as missing data. It is
       not missing — it has not happened, and only ending a Session grades it. */
    table([session({ state: "parked", ended_reason: null, topics_measured: 0 })]);
    expect(screen.getByText(/Parked · not graded/)).toBeInTheDocument();
  });

  it("offers a report for an ended Session and a resume for one that is not", () => {
    table([
      session({ session_id: "a", state: "ended" }),
      session({ session_id: "b", state: "parked", ended_reason: null }),
    ]);
    expect(screen.getByRole("link", { name: /report/i })).toHaveAttribute("href", "/report/a");
    expect(screen.getByRole("link", { name: /resume/i })).toHaveAttribute("href", "/examination/b");
  });

  it("names how a Session ended in words, not in a code", () => {
    table([session({ ended_reason: "plan_exhausted" })]);
    expect(screen.getByText("The plan was run to the end")).toBeInTheDocument();
  });
});

describe("the Session you can act on", () => {
  it("prefers a running Session over a parked one", () => {
    const parked = session({ session_id: "p", state: "parked" });
    const running = session({ session_id: "r", state: "running" });
    expect(openSession([parked, running])?.session_id).toBe("r");
    expect(openSession([parked])?.session_id).toBe("p");
    expect(openSession([session()])).toBeNull();
    expect(openSession(undefined)).toBeNull();
  });

  it("tells a parked Session it is waiting, not finished", () => {
    render(
      <MemoryRouter>
        <OpenSessionCard
          session={session({ state: "parked", ended_reason: null, questions_asked: 2 })}
          scope="Backpropagation"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/has not been graded/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /resume/i })).toBeInTheDocument();
  });

  it("shows the plan position as marks rather than as a figure", () => {
    const { container } = render(
      <MemoryRouter>
        <OpenSessionCard
          session={session({ state: "running", ended_reason: null, questions_asked: 3, budget_questions: 8 })}
          scope="Attention"
        />
      </MemoryRouter>,
    );
    const dots = container.querySelector(".dots");
    expect(dots?.getAttribute("aria-label")).toBe("3 of 8 questions asked");
    expect(dots?.querySelectorAll("i[data-done]")).toHaveLength(3);
    expect(dots?.querySelectorAll("i")).toHaveLength(8);
  });
});
