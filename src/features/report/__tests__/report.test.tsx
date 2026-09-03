import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReportTopic } from "@/shared/types";
import { TopicTable } from "../components/TopicTable";
import type { ReportRow } from "../hooks/useReport";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const row = (over: Partial<ReportTopic> = {}): ReportRow => ({
  topic_id: "t-1",
  title: "Backpropagation",
  module_title: "Neural Networks",
  band: "firm_strong",
  label: "Looks solid",
  coverage: 3.4,
  mastery: 0.82,
  interval: [0.71, 0.9],
  source_score: 0.9,
  truth_score: 0.74,
  graded_by: "ground_truth",
  question_count: 2,
  citations: [],
  credits: 140,
  ...over,
});

describe("the two dimensions are never one", () => {
  /* The Judge reads how much of the material was explained and how close to
     correct the answer was. The average of two different questions answers
     neither, and the number they were combined into fed the posterior — it is
     an input to the maths, not a reading. */
  it("shows the sub-scores apart, and never their combination", () => {
    renderWithProviders(<TopicTable rows={[row({ source_score: 0.9, truth_score: 0.7 })]} route="credits" />);
    /* Opening the drawer is where the two live — never as columns, which
       could be scanned down the page as one ranking. */
    fireEvent.click(screen.getByRole("button", { name: /show the grounding/i }));
    expect(screen.getByText("0.90")).toBeInTheDocument();
    expect(screen.getByText("0.70")).toBeInTheDocument();
    /* 0.5 * 0.9 + 0.5 * 0.7 = 0.80. It must appear nowhere. */
    expect(screen.queryByText("0.80")).not.toBeInTheDocument();
  });

  it("renders an em dash where the Judge took only one reading", () => {
    /* Under model judgment there is no supplied material to have explained,
       so a zero would read as "explained none of it". */
    renderWithProviders(
      <TopicTable rows={[row({ graded_by: "model_judgment", source_score: null })]} route="credits" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show the grounding/i }));
    expect(screen.getByText(/no supplied material/i)).toBeInTheDocument();
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
  });
});

describe("the Evidence Floor, on the report", () => {
  it("gives a Topic below the floor the word and no number", () => {
    const { container } = renderWithProviders(
      <TopicTable
        rows={[row({ band: "untested", label: "Untested", mastery: null, interval: null })]}
        route="credits"
      />,
    );
    expect(screen.getAllByText(/untested/i).length).toBeGreaterThan(0);
    /* `Reading` renders the word even when a figure is passed beside an
       untested band, and the row must not print one around it either. */
    const cell = container.querySelector(".score-cell");
    expect(cell?.textContent).not.toMatch(/\d\.\d\d/);
  });
});

describe("cost off the Credits route", () => {
  it("is an em dash, never a zero", () => {
    const { container } = renderWithProviders(
      <TopicTable rows={[row({ credits: 0 } as Partial<ReportTopic>)]} route="byok" />,
    );
    expect(container.textContent).toContain("—");
    expect(container.textContent).not.toMatch(/\b0 Cr\b/);
    expect(container.textContent).not.toMatch(/Credit/);
  });
});

describe("a Session that reached nothing", () => {
  it("says nothing was measured rather than showing a zero", () => {
    const { container } = renderWithProviders(<TopicTable rows={[]} route="credits" />);
    expect(screen.getByText(/no Topic was reached/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d\.\d\d/);
  });
});
