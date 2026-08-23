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

   3. Refresh is serial. Refresh tokens rotate on every use, and presenting a
      consumed one is treated as theft: the whole session chain is revoked and
      the member is signed out everywhere. Two concurrent 401s must therefore
      queue behind one in-flight refresh — the loser of a race would present a
      token the winner already spent. */

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

/* The single in-flight refresh. Not a lock — a promise everybody awaits, so a
   burst of 401s produces one call to Gatehouse and one rotation. */
let refreshing: Promise<string | null> | null = null;

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
      typeof data.detail === "string" ? data.detail : `${response.status} ${response.statusText}`,
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
  }
}

/* One refresh at a time, and everybody gets the same answer. */
export function refresh(): Promise<string | null> {
  refreshing ??= call<TokenPair>("/auth/refresh")
    .then((pair) => remember(pair).access_token)
    .catch(() => {
      forget();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
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
