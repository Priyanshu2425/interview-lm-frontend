import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { operatorService } from "@/lib/services/operator";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/shared/stores/toasts";
import type { SharedSkillSummary } from "@/shared/types";

/* How often the dashboard asks again while a Source is being read. Mirrors
   the candidate Library's own poll (`useNotebooks`) for the same reason: it
   drives the progress readout and stops the moment nothing is in flight. */
const POLL_MS = 1_500;

function inFlight(skills: SharedSkillSummary[] | undefined): boolean {
  return (skills ?? []).some((s) => s.states.uploaded > 0 || s.states.ingesting > 0);
}

export function useSharedSkills(token: string) {
  const enabled = token.length > 0;
  return useQuery({
    queryKey: queryKeys.operator.skills(token),
    queryFn: () => operatorService.listSkills(token),
    enabled,
    refetchInterval: (query) =>
      inFlight(query.state.data as SharedSkillSummary[] | undefined) ? POLL_MS : false,
  });
}

export function useSharedSkill(token: string, notebookId: string | undefined) {
  const enabled = token.length > 0 && !!notebookId;
  return useQuery({
    queryKey: queryKeys.operator.skill(token, notebookId ?? ""),
    queryFn: () => operatorService.getSkill(token, notebookId as string),
    enabled,
    refetchInterval: (query) => {
      const detail = query.state.data as { sources: { state: string }[] } | undefined;
      const reading = (detail?.sources ?? []).some(
        (s) => s.state === "uploaded" || s.state === "ingesting",
      );
      return reading ? POLL_MS : false;
    },
  });
}

export function useSkillsAdminMutations(token: string, notebookId: string | undefined) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.operator.skills(token) });
    if (notebookId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.operator.skill(token, notebookId) });
    }
  };

  const createSkill = useMutation({
    mutationFn: (title: string) => operatorService.createSkill(token, title),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: "The Skill was not created", body: e.message, tone: "risk" }),
  });

  const uploadFiles = useMutation({
    mutationFn: async (files: File[]) => {
      if (!notebookId) throw new Error("There is no Skill to add to yet.");
      /* Sequential, matching the candidate uploader: each ingest is its own
         background thread, and firing them together buys nothing but load. */
      const added = [];
      for (const file of files) added.push(await operatorService.uploadSkillFile(token, notebookId, file));
      return added;
    },
    onSuccess: (added) => {
      invalidate();
      toast({
        title: `${added.length} document${added.length === 1 ? "" : "s"} added`,
        body: "Reading now — this list updates as each one finishes.",
        tone: "ok",
      });
    },
    onError: (e: Error) => toast({ title: "Upload did not start", body: e.message, tone: "risk" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      operatorService.setSkillActive(token, id, active),
    onSuccess: (_data, variables) => {
      invalidate();
      toast({
        title: variables.active ? "Skill enabled" : "Skill disabled",
        body: variables.active
          ? "It is discoverable again — candidates can be scoped to it."
          : "It no longer appears for new Sessions. Evidence already tied to it is unaffected.",
      });
    },
    onError: (e: Error) => toast({ title: "It was not updated", body: e.message, tone: "risk" }),
  });

  return { createSkill, uploadFiles, toggleActive };
}
