import { useQuery } from "@tanstack/react-query";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { useSessionUser } from "@/shared/stores/session";
import type { SessionListing } from "@/shared/types";

const POLL_MS = 5_000;

/* Every Session this Candidate has sat.
 *
 * Polls only while one is still running — a finished Session cannot change,
 * and a timer that outlives the work holds an idle host awake for nothing. */
export function useSessions() {
  const candidateId = useSessionUser() ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.session.list(candidateId),
    queryFn: () => sessionService.list(),
    select: (data) => data.sessions,
    refetchInterval: (query) =>
      ((query.state.data as { sessions: SessionListing[] } | undefined)?.sessions ?? [])
        .some((s) => s.state === "running")
        ? POLL_MS
        : false,
  });
}

/* The one Session you can act on. A running Session outranks a parked one:
   both resume, but only one is still being examined. */
export function openSession(sessions: SessionListing[] | undefined) {
  const all = sessions ?? [];
  return all.find((s) => s.state === "running") ?? all.find((s) => s.state === "parked") ?? null;
}
