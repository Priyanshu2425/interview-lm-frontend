/* Signing in, through Gatehouse (ADR-0026).

   Identity lives there and nowhere here: no users table, no password handling,
   no account record of our own. What this module holds is an access token, in
   memory, and the discipline around replacing it.

   Three rules, and the third is the one that bites.

   1. The access token stays in memory. `localStorage` is readable by any script
      that gets injected, and a token there outlives the tab that earned it.

   2. Every request names the tenant. Outside development there is no default,
      and a request naming none is refused with 400 before authentication is
      considered at all.

   3. Refresh is serial across ALL tabs. Refresh tokens rotate on every use,
      and presenting a consumed one is treated as theft: the whole session chain
      is revoked and the member is signed out everywhere. Two concurrent 401s
      from different tabs must therefore coordinate — the loser of a race would
      present a token the winner already spent. We use a localStorage lock
      (cross-tab) and an in-memory promise (intra-tab) to guarantee at most one
      refresh is in flight across the entire browser at any time. */

const AUTH = (import.meta.env.VITE_AUTH_URL ?? "https://auth.buildspacelabs.com").replace(/\/$/, "");
const SLUG = import.meta.env.VITE_APP_SLUG ?? "interview-lm";

export class AuthError extends Error {
  readonly status: number;
  readonly field: string | null;

  constructor(status: number, message: string, field: string | null = null) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.field = field;
  }
}

export interface TokenPair {
  access_token: string;
  expires_in: number;
  user_id: string;
}

/* In memory, deliberately. Reloading the page loses it and the refresh cookie
   earns a new one — which is the point: the cookie is httpOnly and no script
   on this page can read it, including one somebody injected. */
let accessToken: string | null = null;
let userId: string | null = null;

const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const currentToken = (): string | null => accessToken;
export const currentUserId = (): string | null => userId;

function remember(pair: TokenPair): TokenPair {
  accessToken = pair.access_token;
  userId = pair.user_id;
  announce();
  return pair;
}

function forget(): void {
  accessToken = null;
  userId = null;
  announce();
}

/* What to say when the identity provider refuses and does not say why.
 *
 * `detail` is preferred whenever there is one — the service that refused knows
 * best, and composing over it is how a surface starts inventing reasons. But a
 * refusal with no body left the raw status on screen, and "409" tells somebody
 * staring at a sign-up form nothing at all about what to do next. Each of these
 * says what happened and what would fix it. */
const REFUSAL: Record<number, string> = {
  400: "Something in that form was not accepted. Check it and try again.",
  401: "That email and password do not match an account.",
  403: "That account is not allowed to sign in here.",
  404: "No account exists for that email.",
  409: "An account already exists for that email. Sign in instead.",
  410: "That link has expired. Ask for a new one.",
  422: "Something in that form was not accepted. Check it and try again.",
  429: "Too many attempts. Wait a moment and try again.",
};

const refusalFor = (status: number): string =>
  REFUSAL[status]
  ?? (status >= 500
    ? "Sign-in is not answering right now. Try again in a moment."
    : "That did not work. Try again.");

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${AUTH}${path}`, {
    method: "POST",
    /* The refresh token is a cookie. Without this it is neither sent nor
       stored, and every refresh fails with nothing in the console to say why. */
    credentials: "include",
    headers: { "content-type": "application/json", "X-App-Slug": SLUG },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new AuthError(
      response.status,
      typeof data.detail === "string" && data.detail.trim()
        ? data.detail
        : refusalFor(response.status),
      typeof data.field === "string" ? data.field : null,
    );
  }
  return data as T;
}

export async function register(email: string, password: string): Promise<TokenPair> {
  return remember(await call<TokenPair>("/auth/register", { email, password }));
}

export async function signIn(email: string, password: string): Promise<TokenPair> {
  return remember(await call<TokenPair>("/auth/login", { email, password }));
}

export async function signOut(): Promise<void> {
  try {
    await call("/auth/logout");
  } finally {
    /* Forgotten locally whatever Gatehouse said. A network failure on the way
       out must not leave somebody looking signed in. */
    forget();
    releaseLock();
  }
}

/* ── Cross-tab refresh coordination ────────────────────────────────────────

   Refresh tokens rotate on every use, and Gatehouse treats a second use of a
   consumed token as theft: the entire session chain is revoked. This means at
   most ONE refresh may be in flight across ALL open tabs at any time.

   The in-memory `refreshing` promise handles bursts within one tab. For
   multiple tabs we use a localStorage lock as a cross-tab mutex:

   - To refresh, a tab writes `{ tabId, ts }` to localStorage under `LOCK_KEY`.
   - If the lock already exists and is fresh (< 30 s), the tab waits on a
     BroadcastChannel for the result instead of refreshing itself.
   - The refreshing tab broadcasts the result when done; waiting tabs pick up
     the new token from the message.
   - A stale lock (> 30 s) is assumed dead (tab crashed) and overwritten.
   - On sign-out the lock is released so other tabs can refresh immediately. */

const LOCK_KEY = "__gh_refresh_lock";
const CHANNEL_NAME = "__gh_refresh";
const LOCK_TTL_MS = 30_000;
const WAIT_TIMEOUT_MS = 10_000;

let tabId: string | null = null;
function getTabId(): string {
  if (tabId === null) tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return tabId;
}

interface Lock {
  tabId: string;
  ts: number;
}

function readLock(): Lock | null {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    return raw ? (JSON.parse(raw) as Lock) : null;
  } catch {
    return null;
  }
}

function writeLock(): void {
  localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: getTabId(), ts: Date.now() }));
}

function releaseLock(): void {
  try {
    const lock = readLock();
    if (lock?.tabId === getTabId()) localStorage.removeItem(LOCK_KEY);
  } catch { /* storage failures are non-fatal */ }
}

function lockIsStale(): boolean {
  const lock = readLock();
  return lock === null || Date.now() - lock.ts > LOCK_TTL_MS;
}

/* The single in-tab in-flight refresh. A burst of 401s within one tab queues
   behind this promise. */
let refreshing: Promise<string | null> | null = null;

/* Wait for another tab to finish its refresh, with a timeout. Returns the new
   token if the other tab succeeded, or null if it failed / timed out. */
function waitForOtherRefresh(): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const cleanup = () => {
      clearTimeout(timeout);
      channel.close();
    };
    channel.onmessage = (event: MessageEvent) => {
      const msg = event.data as { type: string; accessToken?: string };
      if (msg.type === "refreshed" && msg.accessToken) {
        cleanup();
        resolve(msg.accessToken);
      } else if (msg.type === "failed") {
        cleanup();
        resolve(null);
      }
    };
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, WAIT_TIMEOUT_MS);
  });
}

/* Perform the actual refresh call to Gatehouse. */
async function doRefresh(): Promise<TokenPair> {
  return call<TokenPair>("/auth/refresh");
}

/* One refresh at a time, coordinated across all tabs.

   Returns the new access token, or null if the session is dead. */
export async function refresh(): Promise<string | null> {
  /* Fast path: within this tab, a refresh is already in flight. */
  if (refreshing !== null) return refreshing;

  refreshing = (async () => {
    /* If another tab holds a fresh lock, wait for it instead of refreshing. */
    if (!lockIsStale()) {
      const token = await waitForOtherRefresh();
      if (token !== null) {
        /* The other tab already broadcast the new token; pick it up. */
        accessToken = token;
        announce();
        return token;
      }
      /* The other tab's refresh failed or timed out. Try to take the lock. */
      if (!lockIsStale()) {
        /* Lock is still held and fresh — we cannot refresh either. */
        forget();
        return null;
      }
    }

    /* Acquire the cross-tab lock and refresh. */
    writeLock();
    try {
      const pair = await doRefresh();
      remember(pair);
      /* Broadcast the success so every waiting tab picks up the new token
         without spending another refresh token. */
      try {
        new BroadcastChannel(CHANNEL_NAME).postMessage({
          type: "refreshed",
          accessToken: pair.access_token,
        });
      } catch { /* broadcast failures are non-fatal */ }
      return pair.access_token;
    } catch {
      forget();
      try {
        new BroadcastChannel(CHANNEL_NAME).postMessage({ type: "failed" });
      } catch { /* broadcast failures are non-fatal */ }
      return null;
    } finally {
      releaseLock();
      refreshing = null;
    }
  })();

  return refreshing;
}

/* Whether the one start-up refresh has come back yet.

   It matters because "not signed in" is not knowable until it has. A reload
   loses the access token — it was only ever in memory — while the refresh
   cookie survives, so a member who signed in yesterday is signed in now and
   simply has not been told yet. Redirecting before this is true signs people
   out every time they press reload. */
let restored = false;

export const isRestored = (): boolean => restored;

/* Called once, at start-up, before the tree renders. Idempotent: a second call
   returns the same answer rather than spending a second refresh token, which
   Gatehouse would read as reuse and treat as theft. */
export async function restore(): Promise<boolean> {
  const token = await refresh();
  restored = true;
  announce();
  return token !== null;
}

export const passwordReset = {
  request: (email: string) => call("/auth/forgot-password", { email }),
  complete: (token: string, password: string) => call("/auth/reset-password", { token, password }),
};

export const verification = {
  complete: (token: string) => call("/auth/verify-email", { token }),
  resend: (email: string) => call("/auth/resend-verification", { email }),
};
