import { useSyncExternalStore } from "react";

import { currentToken, currentUserId, isRestored, subscribe } from "@/lib/auth/gatehouse";

/* Who is signed in, for the components that need to know.

   The access token lives in a module variable rather than in React state or in
   `localStorage`: state would put it in a component tree that re-renders, and
   `localStorage` would put it somewhere any injected script can read. This is
   the subscription that lets the tree follow it anyway.

   `userId` is Gatehouse's `sub` and is not a `candidate_id`. That one is ours,
   is opaque, and never leaves the server (ADR-0012) — the surface has no use
   for it and no longer holds one. It appears here only to scope the query
   cache, so signing out and signing in as somebody else does not read back the
   previous member's answers. */

const snapshot = (): string =>
  `${currentUserId() ?? ""}:${currentToken() ? "1" : "0"}:${isRestored() ? "1" : "0"}`;

export function useSessionUser(): string | null {
  useSyncExternalStore(subscribe, snapshot, () => ":0");
  return currentUserId();
}

export function useSignedIn(): boolean {
  useSyncExternalStore(subscribe, snapshot, () => ":0");
  return currentToken() !== null;
}

/* Whether the start-up refresh has answered. Until it has, nobody is "signed
   out" — they are unknown, and the difference is a redirect on every reload. */
export function useRestored(): boolean {
  useSyncExternalStore(subscribe, snapshot, () => ":0:1");
  return isRestored();
}
