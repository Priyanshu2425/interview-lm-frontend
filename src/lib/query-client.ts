import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          /* A 4xx the app renders — a refused key, an exhausted balance — is
             the app working. Retrying it just repeats the refusal. */
          if (error instanceof ApiError && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: 0 },
    },
  });
}
