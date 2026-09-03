import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type { Notebook, NotebookSourceDetail, SourceUploaded } from "@/shared/types";

export const notebookService = {
  list: () => api.request<Notebook[]>(endpoints.notebooks.list()),

  /* One Library, with each document's state and progress. This is what the
     surface polls while an ingest runs — a plain read of rows the worker is
     updating, so it costs nothing and cannot itself stall. */
  read: (notebookId: string) => api.request<Notebook>(endpoints.notebooks.one(notebookId)),

  /* No candidate_id: a Corpus belongs to whoever uploaded it, and who that is
     comes from the token that carried the request (ISSUE-0032). */
  /* One document: its extracted text, the Topics cut from it, and where each
     was cut from — in one response, because the offsets only mean anything
     against that exact text. */
  readSource: (notebookId: string, sourceId: string) =>
    api.request<NotebookSourceDetail>(endpoints.notebooks.source(notebookId, sourceId)),

  create: (title: string) =>
    api.request<Notebook>(endpoints.notebooks.create(), {
      method: "POST",
      body: { title },
    }),

  addText: (
    notebookId: string,
    title: string,
    text: string,
    mediaType = "text/markdown",
    url = "",
  ) =>
    api.request<SourceUploaded>(endpoints.notebooks.sources(notebookId), {
      method: "POST",
      body: { title, text, media_type: mediaType, url },
    }),

  addFile: (notebookId: string, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("title", file.name);
    return api.upload<SourceUploaded>(endpoints.notebooks.files(notebookId), form);
  },

  /* Re-ingest a failed document. The bytes are already stored, so this costs
     the embedding again and nothing else — it never re-uploads. */
  retry: (notebookId: string, sourceId: string) =>
    api.request<{ source_id: string; state: string }>(
      endpoints.notebooks.retry(notebookId, sourceId), { method: "POST" },
    ),

  /* One Source out. Its Topics retire; every other Module is untouched. */
  deleteSource: (notebookId: string, sourceId: string) =>
    api.request<null>(endpoints.notebooks.source(notebookId, sourceId), { method: "DELETE" }),

  /* Content goes. Evidence stays, and its Topics retire. */
  remove: (notebookId: string) =>
    api.request<null>(endpoints.notebooks.one(notebookId), { method: "DELETE" }),
};
