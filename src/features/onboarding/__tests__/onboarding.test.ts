import { describe, expect, it } from "vitest";
import { onboardingBody } from "../hooks/useProfile";

/* The route is `extra: "forbid"` and `exclude_unset`. Both halves matter:
   one stray key is a 422 rather than a silent drop, and an omitted key is
   left alone rather than blanked — so a form correcting a display name
   cannot erase a goal it never asked about. */
describe("what the onboarding form sends", () => {
  it("sends only the four keys the route knows", () => {
    const body = onboardingBody({
      display_name: "Priyanshu",
      target_role: "ML engineer",
      experience_level: "early",
      goal: "Interviewing in the spring",
      /* Anything a form might carry and a route would refuse. */
      candidate_id: "cand-1",
      email: "someone@example.com",
    });
    expect(Object.keys(body).sort()).toEqual([
      "display_name", "experience_level", "goal", "target_role",
    ]);
  });

  it("omits an unanswered field rather than sending an empty one", () => {
    const body = onboardingBody({ display_name: "Priyanshu", goal: "   " });
    expect(body).toEqual({ display_name: "Priyanshu" });
    expect("goal" in body).toBe(false);
  });

  it("sends nothing at all when nothing was answered", () => {
    expect(onboardingBody({})).toEqual({});
  });

  it("trims, so a name of spaces is not a name", () => {
    expect(onboardingBody({ display_name: "  Priyanshu  " })).toEqual({
      display_name: "Priyanshu",
    });
  });
});
