import { useQueries } from "@tanstack/react-query";
import { create } from "zustand";
import { operatorService } from "@/lib/services/operator";
import { queryKeys } from "@/lib/query-keys";

/* The operator token is a shared secret, not an identity. It is held for the
   tab and nowhere else: sessionStorage dies with the tab, which is the right
   lifetime for a console credential typed once. */
const STORAGE_KEY = "ilm.operator.v1";

function read(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

interface OperatorAuth {
  token: string;
  setToken: (token: string) => void;
  clear: () => void;
}

export const useOperatorAuth = create<OperatorAuth>((set) => ({
  token: read(),
  setToken: (token) => {
    try { sessionStorage.setItem(STORAGE_KEY, token); } catch { /* nothing to persist to */ }
    set({ token });
  },
  clear: () => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* nothing to remove */ }
    set({ token: "" });
  },
}));

export function useOperatorReadings(token: string) {
  const enabled = token.length > 0;
  const [pool, providers, sessions] = useQueries({
    queries: [
      {
        queryKey: queryKeys.operator.pool(token),
        queryFn: () => operatorService.pool(token),
        enabled,
        refetchInterval: 60_000,
      },
      {
        queryKey: queryKeys.operator.providers(token),
        queryFn: () => operatorService.providers(token),
        enabled,
        refetchInterval: 60_000,
      },
      {
        queryKey: queryKeys.operator.sessions(token),
        queryFn: () => operatorService.sessions(token),
        enabled,
        refetchInterval: 60_000,
      },
    ],
  });

  return {
    pool: pool.data,
    providers: providers.data,
    sessions: sessions.data,
    loading: enabled && (pool.isPending || providers.isPending || sessions.isPending),
    error: (pool.error ?? providers.error ?? sessions.error) as Error | null,
  };
}
