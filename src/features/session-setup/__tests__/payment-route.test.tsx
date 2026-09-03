import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PaymentRoute } from "@/shared/types";
import { PaymentRoutePicker } from "../components/PaymentRoutePicker";

const picker = (
  over: { route?: PaymentRoute; hasKey?: boolean; fingerprint?: string } = {},
  onChange: (r: PaymentRoute) => void = () => {},
) =>
  render(
    <MemoryRouter>
      <PaymentRoutePicker
        route={over.route ?? "credits"}
        hasKey={over.hasKey ?? false}
        fingerprint={over.fingerprint}
        onChange={onChange}
      />
    </MemoryRouter>,
  );

const option = (name: RegExp) => screen.getByRole("radio", { name });

describe("who pays", () => {
  it("offers both routes, and marks the one in force", () => {
    picker({ route: "byok", hasKey: true, fingerprint: "sk-or…9f2c" });
    expect(option(/Let us handle it/)).not.toBeChecked();
    expect(option(/Use my own key/)).toBeChecked();
    expect(screen.getByText(/sk-or…9f2c/)).toBeInTheDocument();
  });

  /* The server refuses `byok` with no key to spend, so the surface must not
     let it be asked for. Offered disabled rather than hidden: a choice that
     vanishes reads as one that never existed. */
  it("cannot choose a key that is not attached", () => {
    picker({ hasKey: false });
    const own = option(/Use my own key/);
    /* Disabled is the guarantee — jsdom will still deliver a synthetic click
       to a disabled control, and a browser will not, so the attribute is what
       this asserts rather than the click. */
    expect(own).toBeDisabled();
    expect(own).not.toBeChecked();
    expect(screen.getByText(/No key attached yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Attach an OpenRouter key/ })).toBeInTheDocument();
  });

  it("lets a Candidate holding a key still choose Credits", () => {
    const onChange = vi.fn();
    picker({ route: "byok", hasKey: true }, onChange);
    fireEvent.click(option(/Let us handle it/));
    expect(onChange).toHaveBeenCalledWith("credits");
  });

  /* A Session's cost is not knowable in advance, and this screen is where a
     figure would be easiest to invent. */
  it("quotes no price and promises no total", () => {
    const { container } = picker({ hasKey: true });
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/estimate|approx|total cost|will cost|per session/i);
    expect(text).toMatch(/not knowable in advance/i);
  });
});
