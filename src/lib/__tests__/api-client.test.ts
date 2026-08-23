import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient } from "../api-client";

/* The case this exists for: a surface built without VITE_API_URL calls its own
   origin, and a static host answers every unknown path with the SPA shell at
   200. Treated as data it becomes `.filter is not a function` three components
   away from the cause. */

const html = "<!doctype html>\n<html lang=\"en\"><head><title>InterviewLM</title>";

describe("the api client", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("refuses a 200 that is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, status: 200, statusText: "OK", text: async () => html,
    } as unknown as Response);

    const client = createApiClient("/v1");
    await expect(client.request("/corpus/tracks")).rejects.toBeInstanceOf(ApiError);
    await expect(client.request("/corpus/tracks")).rejects.toMatchObject({
      code: "not_an_api",
    });
  });

  it("still returns real JSON", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, status: 200, statusText: "OK",
      text: async () => JSON.stringify([{ track_key: "aiml" }]),
    } as unknown as Response);

    const client = createApiClient("/v1");
    await expect(client.request("/corpus/tracks")).resolves.toEqual([{ track_key: "aiml" }]);
  });

  it("keeps an empty body as null rather than refusing it", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true, status: 204, statusText: "No Content", text: async () => "",
    } as unknown as Response);

    const client = createApiClient("/v1");
    await expect(client.request("/notebooks/x")).resolves.toBeNull();
  });

  it("still reads a failure's own code and message", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false, status: 401, statusText: "Unauthorized",
      text: async () => JSON.stringify({ code: "not_signed_in", message: "Sign in to continue." }),
    } as unknown as Response);

    const client = createApiClient("/v1");
    await expect(client.request("/candidates/me/credits")).rejects.toMatchObject({
      status: 401, code: "not_signed_in", message: "Sign in to continue.",
    });
  });
});
