import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CostValue } from "../Cost";

describe("CostValue", () => {
  it("renders an em dash off the Credits route, so zero never reads as free", () => {
    const { container } = render(<CostValue value={0} route="byok" unit="this Visit" />);
    expect(container.textContent).toContain("—");
    expect(container.textContent).not.toContain("0 Cr");
  });

  it("names the ledger in its title on both routes", () => {
    const byok = render(<CostValue value={null} route="byok" />);
    expect(byok.container.querySelector(".cost")?.getAttribute("title")).toMatch(/own key/i);
    const paid = render(<CostValue value={12} route="credits" />);
    expect(paid.container.querySelector(".cost")?.getAttribute("title")).toMatch(/US cent/i);
  });
});
