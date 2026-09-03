import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notebookService } from "@/lib/services/notebooks";
import { queryKeys } from "@/lib/query-keys";
import { useSessionUser } from "@/shared/stores/session";
import { useToast } from "@/shared/stores/toasts";
import type { Notebook, NotebookSource, SourceUploaded } from "@/shared/types";

/* How often the Library asks again while a document is being read. The poll is
   doing two jobs: it drives the progress readout, and because an idle host spins
   down and any inbound request resets that timer, it keeps the server awake for
   as long as somebody is watching. That is a side effect of a request we need
   anyway rather than a keep-alive built for its own sake — so it stops the
   moment nothing is in flight. */
const POLL_MS = 1_500;

/* One rule for "is anything still being read", written once. A document is in
   flight from the moment its bytes land until its Topics are cut. */
export function inFlightSources(sources: NotebookSource[] | undefined): boolean {
  return (sources ?? []).some(
    (s) => s.state === "uploaded" || s.state === "ingesting",
  );
}

export function inFlight(notebooks: Notebook[] | undefined): boolean {
  return (notebooks ?? []).some((n) => inFlightSources(n.sources));
}

export function useNotebooks() {
  const candidateId = useSessionUser() ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.notebooks.list(candidateId),
    queryFn: () => notebookService.list(),
    /* Polls only while there is something to watch, and stops when the last
       document finishes. A timer that outlives the work holds the process
       awake for nothing, and the free tier allows about one instance. */
    refetchInterval: (query) =>
      inFlight(query.state.data as Notebook[] | undefined) ? POLL_MS : false,
  });
}

/* One Library, with each document's state and progress. Polls on the same
   rule as the listing and for the same reason — the progress readout has to
   move, and the request keeping an idle host awake is one we need anyway. */
export function useNotebook(notebookId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notebooks.one(notebookId ?? "none"),
    queryFn: () => notebookService.read(notebookId as string),
    enabled: Boolean(notebookId),
    refetchInterval: (query) =>
      inFlightSources((query.state.data as Notebook | undefined)?.sources)
        ? POLL_MS
        : false,
  });
}

function describe(uploaded: SourceUploaded): string {
  if (uploaded.state === "stub") {
    return uploaded.stub_reason ?? "No text could be read from it.";
  }
  if (uploaded.deduplicated) return "It was already in this Library.";
  /* Work found, before any work is done. The upload answers before the
     embedding starts, so there are no Topics to report yet — and a count of
     zero Topics would read as a document that produced nothing. */
  const n = uploaded.progress_total;
  return `${n} section${n === 1 ? "" : "s"} to read. It is being embedded now.`;
}

export function useNotebookMutations(notebookId: string | undefined) {
  const candidateId = useSessionUser() ?? "anonymous";
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidate = () => {
    /* Every notebook read, not just the listing: the workbench holds a
       notebook and an open document under this prefix, and a retry has to
       refresh all three without naming any of them. */
    void queryClient.invalidateQueries({ queryKey: queryKeys.notebooks.all });
    /* Adding or removing a Source changes what a Session can be scoped to. */
    void queryClient.invalidateQueries({ queryKey: queryKeys.skills.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.candidate.credits(candidateId) });
  };

  const create = useMutation({
    mutationFn: (title: string) => notebookService.create(title),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: "The notebook was not created", body: e.message, tone: "risk" }),
  });

  const addFiles = useMutation({
    mutationFn: async (files: File[]) => {
      if (!notebookId) throw new Error("There is no notebook to add to yet.");
      /* Sequential on purpose. Each ingest debits the same ledger, and firing
         them together would race the balance check that refuses the one that
         cannot be paid for. */
      const added: SourceUploaded[] = [];
      for (const file of files) added.push(await notebookService.addFile(notebookId, file));
      return added;
    },
    onSuccess: (added) => {
      invalidate();
      const stubs = added.filter((a) => a.state === "stub");
      toast({
        title: `${added.length} document${added.length === 1 ? "" : "s"} added`,
        body: stubs.length
          ? `${stubs.length} could not be read: ${stubs[0].stub_reason ?? "no extractable text"}. They are listed rather than hidden.`
          : describe(added[0]),
        tone: stubs.length ? "info" : "ok",
      });
    },
    onError: (e: Error) => {
      /* Rendered from the API's own message: a 402 here names the shortfall in
         Credits, and a BYOK Candidate never reaches this path at all. */
      toast({ title: "Ingest did not start", body: e.message, tone: "risk" });
    },
  });

  const addText = useMutation({
    mutationFn: ({ title, text }: { title: string; text: string }) => {
      if (!notebookId) throw new Error("There is no notebook to add to yet.");
      return notebookService.addText(notebookId, title, text);
    },
    onSuccess: (added) => {
      invalidate();
      toast({ title: "Note added", body: describe(added), tone: "ok" });
    },
    onError: (e: Error) => toast({ title: "Ingest did not start", body: e.message, tone: "risk" }),
  });

  const retrySource = useMutation({
    mutationFn: ({ sourceId }: { sourceId: string; title: string }) => {
      if (!notebookId) throw new Error("There is no notebook to retry in.");
      return notebookService.retry(notebookId, sourceId);
    },
    onSuccess: (_data, variables) => {
      invalidate();
      toast({
        title: `Reading ${variables.title} again`,
        body: "The document was kept, so this re-embeds it and does not upload it again.",
      });
    },
    onError: (e: Error) => toast({ title: "It was not retried", body: e.message, tone: "risk" }),
  });

  const removeSource = useMutation({
    mutationFn: ({ sourceId }: { sourceId: string; title: string }) => {
      if (!notebookId) throw new Error("There is no notebook to remove from.");
      return notebookService.deleteSource(notebookId, sourceId);
    },
    onSuccess: (_data, variables) => {
      invalidate();
      /* Content goes; Evidence stays. Its Topics retire rather than vanish,
         so a Session that examined them keeps its record. */
      toast({
        title: `${variables.title} removed`,
        body: "Its Topics retire. The Evidence they produced stays on the record.",
      });
    },
    onError: (e: Error) => toast({ title: "It was not removed", body: e.message, tone: "risk" }),
  });

  const removeNotebook = useMutation({
    mutationFn: (id: string) => notebookService.remove(id),
    onSuccess: () => {
      invalidate();
      toast({
        title: "Notebook deleted",
        body: "Every Evidence row it produced is still on the record.",
      });
    },
    onError: (e: Error) => toast({ title: "It was not deleted", body: e.message, tone: "risk" }),
  });

  return { create, addFiles, addText, retrySource, removeSource, removeNotebook };
}
