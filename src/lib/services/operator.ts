import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type {
  OperatorProviders, OperatorSessions, PoolReading,
  SharedSkillDetail, SharedSkillSummary,
} from "@/shared/types";

const auth = (token: string) => ({ headers: { "x-operator-token": token } });

export const operatorService = {
  pool: (token: string) => api.request<PoolReading>(endpoints.operator.pool(), auth(token)),
  providers: (token: string) =>
    api.request<OperatorProviders>(endpoints.operator.providers(), auth(token)),
  sessions: (token: string) =>
    api.request<OperatorSessions>(endpoints.operator.sessions(), auth(token)),

  /* -- Skills admin ------------------------------------------------------ */

  listSkills: (token: string) =>
    api.request<SharedSkillSummary[]>(endpoints.operator.skills(), auth(token)),

  getSkill: (token: string, notebookId: string) =>
    api.request<SharedSkillDetail>(endpoints.operator.skill(notebookId), auth(token)),

  createSkill: (token: string, title: string) =>
    api.request<{ notebook_id: string; title: string; active: boolean }>(
      endpoints.operator.skills(),
      { ...auth(token), method: "POST", body: { title } },
    ),

  uploadSkillFile: (token: string, notebookId: string, file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    form.append("title", file.name);
    return api.upload<{ source_id: string; state: string }>(
      endpoints.operator.skillFiles(notebookId), form, undefined,
      { "x-operator-token": token },
    );
  },

  setSkillActive: (token: string, notebookId: string, active: boolean) =>
    api.request<{ notebook_id: string; active: boolean }>(
      endpoints.operator.skillActive(notebookId),
      { ...auth(token), method: "PATCH", body: { active } },
    ),
};
