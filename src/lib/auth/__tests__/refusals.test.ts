import { describe, expect, it, vi, afterEach } from "vitest";
import { AuthError, register, signIn } from "../gatehouse";

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,
    status,
    statusText: "",
    text: async () => JSON.stringify(body),
  } as Response);

afterEach(() => vi.restoreAllMocks());

describe("a refusal is a sentence, never a status code", () => {
  it("says an account already exists rather than showing 409", async () => {
    /* Gatehouse refuses a duplicate registration with no body. The screen
       used to render "409", which tells somebody at a sign-up form nothing
       about what to do next. */
    respond(409, {});
    await expect(register("taken@example.com", "hunter2hunter2")).rejects.toThrow(
      /already exists/i,
    );
  });

  it("never puts a bare number in front of anybody", async () => {
    for (const status of [400, 401, 403, 404, 409, 410, 422, 429, 500, 503, 418]) {
      respond(status, {});
      const error: unknown = await signIn("a@b.com", "x").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AuthError);
      const { message } = error as AuthError;
      expect(message).not.toMatch(/^\d{3}/);
      expect(message.length).toBeGreaterThan(12);
      vi.restoreAllMocks();
    }
  });

  it("prefers what the service said over anything we would compose", async () => {
    /* The service that refused knows best. Composing over its own words is
       how a surface starts inventing reasons. */
    respond(409, { detail: "That email is on a waiting list." });
    await expect(register("a@b.com", "x")).rejects.toThrow(
      "That email is on a waiting list.",
    );
  });

  it("ignores a detail that is only whitespace", async () => {
    respond(404, { detail: "   " });
    await expect(signIn("a@b.com", "x")).rejects.toThrow(/no account exists/i);
  });
});
