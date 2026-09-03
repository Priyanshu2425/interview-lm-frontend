import { useQuery } from "@tanstack/react-query";
import { notebookService } from "@/lib/services/notebooks";
import { queryKeys } from "@/lib/query-keys";
import type { NotebookSource } from "@/shared/types";

const POLL_MS = 1_500;

/* One document, read back whole.
 *
 * The poll is decided from the *listing's* row rather than from this
 * response, because the listing is already polling and knows first. A `ready`
 * document is frozen — its Topics were cut once, at ingest (ADR-0015) — so
 * asking again could only return the same answer, and `staleTime: Infinity`
 * is what keeps "send the whole text" from being a cost paid on a timer. */
export function useNotebookSource(
  notebookId: string | undefined,
  source: NotebookSource | undefined,
) {
  const reading = source
    ? source.state === "uploaded" || source.state === "ingesting"
    : false;

  return useQuery({
    queryKey: queryKeys.notebooks.source(
      notebookId ?? "none",
      source?.source_id ?? "none",
    ),
    queryFn: () =>
      notebookService.readSource(notebookId as string, source!.source_id),
    enabled: Boolean(notebookId && source),
    staleTime: reading ? 0 : Infinity,
    refetchInterval: reading ? POLL_MS : false,
  });
}
