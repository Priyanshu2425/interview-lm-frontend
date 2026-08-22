import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type { Notebook, SourceAdded } from "@/shared/types";

export const notebookService = {
  list: (candidateId: string) => api.request<Notebook[]>(endpoints.notebooks.list(candidateId)),

  create: (candidateId: string, title: string) =>
    api.request<Notebook>(endpoints.notebooks.create(), {
      method: "POST",
      body: { candidate_id: candidateId, title },
    }),

  addText: (
    notebookId: string,
    title: string,
    text: string,
    mediaType = "text/markdown",
    url = "",
  ) =>
    api.request<SourceAdded>(endpoints.notebooks.sources(notebookId), {
      method: "POST",
      body: { title, text, media_type: mediaType, url },
    }),

  addFile: (notebookId: string, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("title", file.name);
    return api.upload<SourceAdded>(endpoints.notebooks.files(notebookId), form);
  },

  /* One Source out. Its Topics retire; every other Module is untouched. */
  deleteSource: (notebookId: string, sourceId: string) =>
    api.request<null>(endpoints.notebooks.source(notebookId, sourceId), { method: "DELETE" }),

  /* Content goes. Evidence stays, and its Topics retire. */
  remove: (notebookId: string) =>
    api.request<null>(endpoints.notebooks.one(notebookId), { method: "DELETE" }),
};
