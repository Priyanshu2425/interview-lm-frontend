import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notebookService } from "@/lib/services/notebooks";
import { queryKeys } from "@/lib/query-keys";
import { useCandidateId } from "@/shared/stores/identity";
import { useToast } from "@/shared/stores/toasts";
import type { SourceAdded } from "@/shared/types";

export function useNotebooks() {
  const candidateId = useCandidateId();
  return useQuery({
    queryKey: queryKeys.notebooks.list(candidateId),
    queryFn: () => notebookService.list(candidateId),
  });
}

function describe(added: SourceAdded): string {
  if (added.state === "stub") {
    return added.stub_reason ?? "No text could be read from it.";
  }
  return `${added.topics} Topic${added.topics === 1 ? "" : "s"} · ${added.chunks} chunk${added.chunks === 1 ? "" : "s"}`;
}

export function useNotebookMutations(notebookId: string | undefined) {
  const candidateId = useCandidateId();
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notebooks.list(candidateId) });
    /* Adding or removing a Source changes what a Session can be scoped to. */
    void queryClient.invalidateQueries({ queryKey: queryKeys.corpus.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.candidate.credits(candidateId) });
  };

  const create = useMutation({
    mutationFn: (title: string) => notebookService.create(candidateId, title),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: "The notebook was not created", body: e.message, tone: "risk" }),
  });

  const addFiles = useMutation({
    mutationFn: async (files: File[]) => {
      if (!notebookId) throw new Error("There is no notebook to add to yet.");
      /* Sequential on purpose. Each ingest debits the same ledger, and firing
         them together would race the balance check that refuses the one that
         cannot be paid for. */
      const added: SourceAdded[] = [];
      for (const file of files) added.push(await notebookService.addFile(notebookId, file));
      return added;
    },
    onSuccess: (added) => {
      invalidate();
      const stubs = added.filter((a) => a.state === "stub");
      toast({
        title: `${added.length} source${added.length === 1 ? "" : "s"} ingested`,
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
      toast({ title: "Note ingested", body: describe(added), tone: "ok" });
    },
    onError: (e: Error) => toast({ title: "Ingest did not start", body: e.message, tone: "risk" }),
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

  return { create, addFiles, addText, removeSource, removeNotebook };
}
