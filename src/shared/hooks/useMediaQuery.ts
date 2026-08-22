import { useSyncExternalStore } from "react";

/* One listener per query string, shared by every caller. Ten components asking
   for `(max-width: 900px)` register one matchMedia, not ten. */
const stores = new Map<string, { subscribe: (cb: () => void) => () => void; get: () => boolean }>();

function storeFor(query: string) {
  const existing = stores.get(query);
  if (existing) return existing;

  const mql = window.matchMedia(query);
  const listeners = new Set<() => void>();
  const onChange = () => { for (const l of listeners) l(); };

  const store = {
    subscribe(cb: () => void) {
      if (listeners.size === 0) mql.addEventListener("change", onChange);
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
        if (listeners.size === 0) mql.removeEventListener("change", onChange);
      };
    },
    get: () => mql.matches,
  };
  stores.set(query, store);
  return store;
}

export function useMediaQuery(query: string): boolean {
  const store = typeof window === "undefined" ? null : storeFor(query);
  return useSyncExternalStore(
    store ? store.subscribe : () => () => {},
    store ? store.get : () => false,
    () => false,
  );
}

export const useIsCompact = () => useMediaQuery("(max-width: 900px)");
export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
