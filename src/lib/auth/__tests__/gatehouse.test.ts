import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Refresh tokens rotate on every use, and presenting a consumed one is treated
   as theft: Gatehouse revokes the whole session chain and the member is signed
   out everywhere. So the property under test is not "refresh works" — it is
   that a burst of 401s produces exactly one refresh. */

async function freshModule() {
  vi.resetModules();
  return import("../gatehouse");
}

const pair = (token: string) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify({ access_token: token, expires_in: 900, user_id: "member-1" }),
});

describe("the session", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("holds the access token in memory and not in storage", async () => {
    const gatehouse = await freshModule();
    vi.mocked(fetch).mockResolvedValue(pair("token-1") as unknown as Response);

    await gatehouse.signIn("a@b.c", "a long enough one");

    expect(gatehouse.currentToken()).toBe("token-1");
    expect(JSON.stringify(localStorage)).not.toContain("token-1");
  });

  it("refreshes once however many callers ask at the same time", async () => {
    const gatehouse = await freshModule();
    let resolve!: (r: unknown) => void;
    vi.mocked(fetch).mockReturnValue(
      new Promise((r) => { resolve = r; }) as unknown as Promise<Response>,
    );

    const all = Promise.all([gatehouse.refresh(), gatehouse.refresh(), gatehouse.refresh()]);
    resolve(pair("token-2"));
    const tokens = await all;

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(["token-2", "token-2", "token-2"]);
  });

  it("can refresh again after the first one has settled", async () => {
    const gatehouse = await freshModule();
    vi.mocked(fetch).mockResolvedValue(pair("token-3") as unknown as Response);

    await gatehouse.refresh();
    await gatehouse.refresh();

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("names the tenant and sends the cookie on every call", async () => {
    const gatehouse = await freshModule();
    vi.mocked(fetch).mockResolvedValue(pair("token-4") as unknown as Response);

    await gatehouse.signIn("a@b.c", "a long enough one");

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-App-Slug"]).toBe("interview-lm");
    /* Without this the refresh cookie is neither stored nor sent, and every
       refresh fails with nothing in the console to say why. */
    expect(init.credentials).toBe("include");
  });

  it("forgets the token when a refresh fails", async () => {
    const gatehouse = await freshModule();
    vi.mocked(fetch).mockResolvedValue(pair("token-5") as unknown as Response);
    await gatehouse.signIn("a@b.c", "a long enough one");

    vi.mocked(fetch).mockResolvedValue({
      ok: false, status: 401, statusText: "Unauthorized", text: async () => "{}",
    } as unknown as Response);
    const token = await gatehouse.refresh();

    expect(token).toBeNull();
    expect(gatehouse.currentToken()).toBeNull();
  });

  it("forgets the token even when signing out fails", async () => {
    const gatehouse = await freshModule();
    vi.mocked(fetch).mockResolvedValue(pair("token-6") as unknown as Response);
    await gatehouse.signIn("a@b.c", "a long enough one");

    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    await expect(gatehouse.signOut()).rejects.toThrow();

    /* A network failure on the way out must not leave somebody looking signed in. */
    expect(gatehouse.currentToken()).toBeNull();
  });
});
