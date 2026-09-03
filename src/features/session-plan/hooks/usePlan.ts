import { useQuery } from "@tanstack/react-query";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";

/* The plan a Session is executing (ISSUE-0041).

   Fixed before the first question and refused an UPDATE by the database, so
   it is read once and re-read only when the turn mutation says an item's
   state moved. A Session may honestly have no plan — MCP Mode's do not, and
   neither does anything started before the planner existed — so a 404 is an
   answer rather than a failure, and consumers render nothing for it. */
export function usePlan(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.session.plan(sessionId),
    queryFn: () => sessionService.plan(sessionId),
    enabled: Boolean(sessionId),
    staleTime: Infinity,
    retry: (count, error) =>
      error instanceof ApiError && error.status === 404 ? false : count < 1,
  });
}
