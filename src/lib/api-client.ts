/* The HTTP layer, and nothing else.

   The surface holds no invariant (ADR-0009): it supplies an Answer Turn and
   renders what it is given. Three things this client deliberately cannot do:
     - compute a score, a band or a posterior. Those arrive decided.
     - decide what to ask next. Topic selection lives in the graph.
     - hold an Answer Key. There is no route that would return one. */

import { currentToken, refresh } from "./auth/gatehouse";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly data: unknown;

  constructor(status: number, message: string, data: unknown, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }

  /* A timeout is a park, not an error: recovery reads the Session and resumes,
     the same path an interruption uses. */
  get isRecoverable(): boolean {
    return this.status === 408 || this.status === 504 || this.status >= 500;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface ApiClient {
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
  upload: <T>(path: string, form: FormData, signal?: AbortSignal) => Promise<T>;
}

function messageOf(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    /* Failure copy renders from the API's own `code` and `message`. Composing
       it here is what would let a Credit message reach a BYOK Candidate. */
    if (typeof record.message === "string") return record.message;
    if (typeof record.detail === "string") return record.detail;
  }
  return fallback;
}

function codeOf(data: unknown): string | null {
  if (data && typeof data === "object") {
    const code = (data as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }
  return null;
}

/* Marks a body that did not parse as JSON, so a success can tell the
   difference between "the API said this" and "something else answered". */
const UNPARSED = Symbol("unparsed");

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    /* Kept for the message — an HTML error page from a proxy still says
       something useful — but flagged, because it is not data. */
    return { detail: text.slice(0, 200), [UNPARSED]: true };
  }
}

function unparsed(data: unknown): boolean {
  return typeof data === "object" && data !== null && UNPARSED in data;
}

export interface ClientOptions {
  credentials?: RequestCredentials;
}

/* The token is attached here rather than by every caller, and a 401 is retried
   exactly once behind the single in-flight refresh (ADR-0026). Retrying more
   than once would be a loop: the second 401 after a fresh token is an answer
   about this request, not about the session. */
async function authorize(headers: Record<string, string>): Promise<Record<string, string>> {
  const token = currentToken();
  return token ? { ...headers, authorization: `Bearer ${token}` } : headers;
}

export function createApiClient(baseUrl: string, options: ClientOptions = {}): ApiClient {
  const credentials = options.credentials ?? "same-origin";

  async function settle<T>(response: Response, fallback: string): Promise<T> {
    const data = await parse(response);
    if (!response.ok) {
      throw new ApiError(response.status, messageOf(data, fallback), data, codeOf(data));
    }
    /* A 200 that is not JSON is not a success, whatever the status line says.

       This is not hypothetical: a surface built with no VITE_API_URL calls its
       own origin, and a static host answers every unknown path with the SPA
       shell at 200. The shell parsed as `{detail: "<!doctype html>…"}` and was
       handed to screens expecting an array, which failed later and elsewhere
       as "filter is not a function" — an error naming neither the request nor
       the reason. Refused here, where the cause is still visible. */
    if (unparsed(data)) {
      throw new ApiError(
        response.status,
        "The API answered with something that is not JSON. If this surface was "
        + "built without VITE_API_URL it is calling itself, and the page you are "
        + "looking at is the reply.",
        data,
        "not_an_api",
      );
    }
    return data as T;
  }

  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const { method = "GET", body, headers, signal } = options;
      const send = async (extra: Record<string, string>): Promise<Response> =>
        fetch(baseUrl + path, {
          method,
          signal,
          credentials,
          headers: { "content-type": "application/json", ...headers, ...extra },
          body: body === undefined ? undefined : JSON.stringify(body),
        });

      let response = await send(await authorize({}));
      if (response.status === 401 && (await refresh()) !== null) {
        response = await send(await authorize({}));
      }
      return settle<T>(response, `${response.status} ${response.statusText}`);
    },

    /* A PDF is a file. Sending it through the JSON helper would mean base64,
       which doubles a 20 MB upload for nothing. */
    async upload<T>(path: string, form: FormData, signal?: AbortSignal): Promise<T> {
      const send = async (): Promise<Response> =>
        fetch(baseUrl + path, {
          method: "POST", body: form, signal, credentials,
          headers: await authorize({}),
        });
      let response = await send();
      if (response.status === 401 && (await refresh()) !== null) {
        response = await send();
      }
      return settle<T>(response, `${response.status} ${response.statusText}`);
    },
  };
}

/* Same origin unless told otherwise.

   SPEC-0000 §7 chose same-origin and this file needed no configuration for it:
   the API mounts `dist/` at `/`, and Vite proxies `/v1` in dev. Hosting the
   surface separately reverses that (ADR-0020), and `VITE_API_URL` is how — it
   is baked in at build time, so a surface always knows which API it was built
   against rather than discovering it at runtime.

   `credentials` follows from the same decision: a cross-origin request does not
   carry cookies unless it says so, and a same-origin one does not need to. */
const configured = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

export const api = createApiClient(`${configured}/v1`, {
  credentials: configured ? "include" : "same-origin",
});

/* One idempotency key per composed answer, reused on every retry. A mashed
   submit button, a flaky network and a browser refresh all converge on one
   Answer Turn — which is why ADR-0011 chose a request over a socket. */
export function turnKey(sessionId: string, turnIndex: number): string {
  return `${sessionId}:${turnIndex}`;
}
