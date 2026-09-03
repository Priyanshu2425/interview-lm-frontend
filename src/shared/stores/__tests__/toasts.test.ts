import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_MS, useToastStore } from "../toasts";

const store = () => useToastStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => vi.useRealTimers());

describe("a toast takes itself away", () => {
  it("is gone after twenty seconds", () => {
    store().push({ title: "Saved" });
    expect(store().toasts).toHaveLength(1);

    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(store().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(store().toasts).toHaveLength(0);
  });

  it("goes sooner when it is dismissed", () => {
    const id = store().push({ title: "Saved" });
    store().dismiss(id);
    expect(store().toasts).toHaveLength(0);

    /* And the timer it left behind must not fire into a later list, or one
       toast is taken away by an earlier one's clock. */
    store().push({ title: "A second one" });
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(store().toasts).toHaveLength(1);
  });

  it("gives each toast its own clock", () => {
    store().push({ title: "First" });
    vi.advanceTimersByTime(TOAST_MS / 2);
    store().push({ title: "Second" });

    vi.advanceTimersByTime(TOAST_MS / 2);
    expect(store().toasts.map((t) => t.title)).toEqual(["Second"]);

    vi.advanceTimersByTime(TOAST_MS / 2);
    expect(store().toasts).toHaveLength(0);
  });

  it("is long enough to read a refusal", () => {
    /* Several of these carry the API's own reason for declining something.
       A message that vanishes before it is read is the same as none. */
    expect(TOAST_MS).toBeGreaterThanOrEqual(20_000);
  });
});
