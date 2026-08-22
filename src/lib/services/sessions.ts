import { api, turnKey } from "../api-client";
import { endpoints } from "../endpoints";
import type {
  SessionRecord, SessionSummary, Spend, StartSessionInput, TurnResult,
} from "@/shared/types";

interface StartResponse {
  session_id: string;
  kind: TurnResult["kind"];
  payment_route: string;
  [key: string]: unknown;
}

export const sessionService = {
  start: (input: StartSessionInput) =>
    api.request<StartResponse>(endpoints.sessions.create(), { method: "POST", body: input }),

  /* Long-running: it returns when the graph next parks. Idempotent on its key,
     so a mashed button, a dropped connection and a refresh converge on one
     Answer Turn. */
  submitTurn: (sessionId: string, answer: string, turnIndex: number) =>
    api.request<TurnResult>(endpoints.sessions.turns(sessionId), {
      method: "POST",
      body: { answer },
      headers: { "Idempotency-Key": turnKey(sessionId, turnIndex) },
    }),

  get: (sessionId: string) => api.request<SessionRecord>(endpoints.sessions.one(sessionId)),

  resume: (sessionId: string) =>
    api.request<Record<string, unknown>>(endpoints.sessions.resume(sessionId), { method: "POST" }),

  /* Soft: the current Topic Visit completes first. */
  end: (sessionId: string) =>
    api.request<{ state: string; note?: string; reason?: string; topic_visit_id?: string }>(
      endpoints.sessions.end(sessionId), { method: "POST" },
    ),

  spend: (sessionId: string) => api.request<Spend>(endpoints.sessions.spend(sessionId)),

  summary: (sessionId: string) => api.request<SessionSummary>(endpoints.sessions.summary(sessionId)),
};
