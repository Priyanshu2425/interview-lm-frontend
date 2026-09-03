import { api, turnKey } from "../api-client";
import { endpoints } from "../endpoints";
import type {
  EndResult, SessionListing, SessionPlan, SessionRecord, SessionReport,
  SessionSummary, SessionTranscript, Spend, StartSessionInput, TurnResult,
} from "@/shared/types";

interface StartResponse {
  session_id: string;
  kind: TurnResult["kind"];
  payment_route: string;
  [key: string]: unknown;
}

export const sessionService = {
  /* Every Session this Candidate has sat, newest first. Served rather than
     remembered: the local history holds five entries and only from the
     browser that ran them. */
  list: () =>
    api.request<{ sessions: SessionListing[] }>(endpoints.sessions.list()),

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

  /* Soft: the question being asked completes first, and that case answers
     with a note rather than an outcome. Ending is also grading (ISSUE-0044),
     so the other shape says how many Topics it graded — and says `parked`
     where the Session is waiting rather than over, which is not a result. */
  end: (sessionId: string) =>
    api.request<EndResult>(endpoints.sessions.end(sessionId), { method: "POST" }),

  spend: (sessionId: string) => api.request<Spend>(endpoints.sessions.spend(sessionId)),

  summary: (sessionId: string) => api.request<SessionSummary>(endpoints.sessions.summary(sessionId)),

  /* Fixed before the first question and never rewritten, so this is read once
     and re-read only when an item's state changes (ISSUE-0041). 404 where a
     Session has no plan: MCP Mode's, and anything older than the planner. */
  plan: (sessionId: string) => api.request<SessionPlan>(endpoints.sessions.plan(sessionId)),

  /* Everything that was said, in order. No score appears here — while a
     Session runs there is none. */
  transcript: (sessionId: string) =>
    api.request<SessionTranscript>(endpoints.sessions.transcript(sessionId)),

  /* The Session's result, whole. Read-only, so the same Session reports the
     same reading twice. */
  report: (sessionId: string) => api.request<SessionReport>(endpoints.sessions.report(sessionId)),
};
