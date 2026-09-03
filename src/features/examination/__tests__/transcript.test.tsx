import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Transcript } from "../components/Transcript";
import type { Turn } from "../hooks/useExamination";

const turns: Turn[] = [
  { id: "1", role: "examiner", text: "Derive the backpropagation update rule." },
  { id: "2", role: "you", text: "You take the gradient of the loss and apply the chain rule." },
  { id: "3", role: "probe", text: "Where does the chain rule enter, exactly?" },
  { id: "4", role: "hint", text: "Think about composing the layers." },
];

describe("the exchange while a Session runs", () => {
  it("labels every kind of turn", () => {
    const { container } = render(
      <Transcript turns={turns} thinking={false} resumedMidQuestion={false} />,
    );
    const roles = [...container.querySelectorAll(".turn-role")].map((n) => n.textContent);
    expect(roles).toEqual(["Examiner", "You", "Probe", "Hint"]);
  });

  /* Since ISSUE-0042 nothing is graded until the Session ends, so no score,
     band or posterior exists to render here. A numeral in the exchange means
     a reading has leaked into a place that has none. */
  it("carries no reading of any kind", () => {
    const { container } = render(
      <Transcript turns={turns} thinking={false} resumedMidQuestion={false} />,
    );
    expect(container.textContent).not.toMatch(/\d\.\d\d/);
    expect(container.textContent).not.toMatch(/\bscore\b/i);
  });

  it("says so when the earlier turns could not be read back", () => {
    const { container } = render(
      <Transcript turns={turns} thinking={false} resumedMidQuestion />,
    );
    expect(container.textContent).toMatch(/picked up mid-question/i);
  });

  /* When the transcript answers, the turns are simply there and there is
     nothing to apologise for. */
  it("says nothing when they could", () => {
    const { container } = render(
      <Transcript turns={turns} thinking={false} resumedMidQuestion={false} />,
    );
    expect(container.textContent).not.toMatch(/picked up mid-question/i);
  });
});
