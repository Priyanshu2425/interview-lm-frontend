import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import { useToast } from "@/shared/stores/toasts";
import { useSessionUser } from "@/shared/stores/session";
import type {
  Citation, QuestionPayload, SessionEnded, SessionParked, TurnResult, VisitClosed,
} from "@/shared/types";

export type TurnRole = "examiner" | "you" | "probe" | "hint";

/* The transcript is a stream of events, not a list of sentences. A closed
   Visit is one of those events and belongs in the stream at the moment it
   happened — the next Visit's opening question arrives in the same response,
   and rendering the score after that question would put the record out of
   order. */
export type TranscriptEntry =
  | { id: string; type: "turn"; role: TurnRole; text: string; citations?: Citation[] }
  | { id: string; type: "visit"; visit: VisitClosed };

export type Turn = Extract<TranscriptEntry, { type: "turn" }>;

const ROLE_OF: Record<string, TurnRole> = {
  question: "examiner",
  probe: "probe",
  hint: "hint",
  close: "examiner",
};

let turnSeq = 0;
const nextTurnId = () => `turn-${++turnSeq}`;

export interface ExaminationState {
  loading: boolean;
  /* The failure that stopped the read, rendered from the API's own message. */
  loadError: string | null;
  entries: TranscriptEntry[];
  /* True after a reload: the exchange so far is on the record, but the surface
     is not served it back. Saying so is more honest than an empty transcript
     that implies the Visit just began. */
  resumedMidVisit: boolean;
  current: QuestionPayload | null;
  lastVisit: VisitClosed | null;
  ended: SessionEnded | null;
  parked: SessionParked | null;
  sending: boolean;
  submitError: string | null;
  durationSeconds: number;
  paymentRoute: "credits" | "byok";
  visitsScored: number;
  visitsSeen: number;
  submit: (answer: string) => void;
  retry: () => void;
  resume: () => void;
  resuming: boolean;
  dismissVisit: () => void;
}

export function useExamination(sessionId: string): ExaminationState {
  const queryClient = useQueryClient();
  const candidateId = useSessionUser() ?? "anonymous";
  const toast = useToast();
  const markEnded = useSessionHistory((s) => s.markEnded);

  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [current, setCurrent] = useState<QuestionPayload | null>(null);
  const [lastVisit, setLastVisit] = useState<VisitClosed | null>(null);
  const [ended, setEnded] = useState<SessionEnded | null>(null);
  const [parked, setParked] = useState<SessionParked | null>(null);
  const [resumedMidVisit, setResumedMidVisit] = useState(false);
  const [scoredHere, setScoredHere] = useState(0);

  /* One idempotency key per composed answer, reused on every retry. It only
     advances when a turn has actually landed, so a retry after a timeout
     converges on the same Answer Turn rather than opening a second one. */
  const turnIndex = useRef(0);
  const pendingAnswer = useRef<string | null>(null);

  const record = useQuery({
    queryKey: queryKeys.session.one(sessionId),
    queryFn: () => sessionService.get(sessionId),
    enabled: Boolean(sessionId),
    /* The Session is authoritative on the server. Re-reading it on every
       render would fight the local transcript, so it is read once per id and
       then driven by turn results. */
    staleTime: Infinity,
    retry: 1,
  });

  /* Seed once per Session id, from the Session the server already holds.
     Adjusted during render rather than in an effect so the first paint after
     the read is the seeded one — a Candidate resuming should never see an
     empty transcript flash before their open question appears. */
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (record.data && seededFor !== sessionId) {
    setSeededFor(sessionId);
    const pending = record.data.pending;
    if (pending) {
      setCurrent(pending);
      setEntries([{
        id: nextTurnId(), type: "turn",
        role: ROLE_OF[pending.kind] ?? "examiner", text: pending.question,
      }]);
      setResumedMidVisit(pending.turn > 1);
    }
    if (record.data.state === "ended") {
      setEnded({ session_id: sessionId, reason: record.data.ended_reason ?? "ended" });
    } else if (record.data.state === "parked" && !pending) {
      setParked({
        session_id: sessionId,
        code: record.data.parked_reason ?? "parked",
        message:
          "This Session stopped at a Topic boundary. Nothing was lost — resuming opens the next Visit.",
        provider: record.data.provider ?? "",
        recoverable: true,
      });
    }
  }

  /* Writing to the history store is a side effect on something outside React,
     so it belongs in an effect. */
  const endedReason = ended?.reason;
  useEffect(() => {
    if (endedReason) markEnded(sessionId);
  }, [endedReason, sessionId, markEnded]);

  const apply = useCallback((result: TurnResult) => {
    if (result.kind === "session_parked") {
      setParked(result.payload);
      return;
    }
    if (result.kind === "session_ended") {
      const payload = result.payload;
      if (payload.last_visit) {
        const visit = payload.last_visit;
        setLastVisit(visit);
        setScoredHere((n) => n + 1);
        setEntries((prev) => [...prev, { id: nextTurnId(), type: "visit", visit }]);
      }
      setEnded(payload);
      setCurrent(null);
      markEnded(sessionId);
      return;
    }
    if (result.kind === "visit_closed") {
      const visit = result.payload;
      setLastVisit(visit);
      setScoredHere((n) => n + 1);
      setEntries((prev) => [...prev, { id: nextTurnId(), type: "visit", visit }]);
      setCurrent(null);
      return;
    }
    const payload = result.payload;
    setEntries((prev) => {
      const next = [...prev];
      /* The score for the Visit that just closed, then the question that opens
         the next one — in that order, because that is the order they happened
         in. */
      if (payload.last_visit) {
        next.push({ id: nextTurnId(), type: "visit", visit: payload.last_visit });
      }
      next.push({
        id: nextTurnId(), type: "turn",
        role: ROLE_OF[payload.kind] ?? "examiner", text: payload.question,
      });
      return next;
    });
    if (payload.last_visit) { setLastVisit(payload.last_visit); setScoredHere((n) => n + 1); }
    setCurrent(payload);
  }, [markEnded, sessionId]);

  const turn = useMutation({
    mutationFn: (answer: string) => sessionService.submitTurn(sessionId, answer, turnIndex.current),
    onSuccess: (result) => {
      turnIndex.current += 1;
      pendingAnswer.current = null;
      apply(result);
      /* Spend moved. Anything reading it should notice without polling. */
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.spend(sessionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.candidate.confidence(candidateId) });
    },
  });

  const resume = useMutation({
    mutationFn: () => sessionService.resume(sessionId),
    onSuccess: (payload) => {
      setParked(null);
      const kind = (payload.kind as TurnResult["kind"] | undefined) ?? "question";
      apply({ kind, payload } as unknown as TurnResult);
      toast({ title: "Session resumed", body: "Picking up where it stopped." });
    },
    onError: (error: Error) => {
      toast({ title: "Nothing to resume", body: error.message, tone: "risk" });
    },
  });

  const submit = useCallback((answer: string) => {
    const text = answer.trim();
    if (!text) return;
    pendingAnswer.current = text;
    setEntries((prev) => [...prev, { id: nextTurnId(), type: "turn", role: "you", text }]);
    turn.mutate(text);
  }, [turn]);

  const retry = useCallback(() => {
    /* The same key, so the server converges on one Answer Turn no matter how
       many times the network dropped it. */
    if (pendingAnswer.current) turn.mutate(pendingAnswer.current);
  }, [turn]);

  const submitError = useMemo(() => {
    const error = turn.error;
    if (!error) return null;
    if (error instanceof ApiError) return error.message;
    return "The connection dropped before the answer landed. Sending it again resolves to the same Answer Turn.";
  }, [turn.error]);

  const visitsSeen = record.data?.visits.length ?? 0;
  const visitsScored = Math.max(
    scoredHere,
    record.data?.visits.filter((v) => v.state === "graded").length ?? 0,
  );

  return {
    loading: record.isPending,
    loadError: record.error ? (record.error as Error).message : null,
    entries,
    resumedMidVisit,
    current,
    lastVisit,
    ended,
    parked,
    sending: turn.isPending,
    submitError,
    durationSeconds: record.data?.duration_seconds ?? 0,
    paymentRoute: record.data?.payment_route ?? "credits",
    visitsScored,
    visitsSeen,
    submit,
    retry,
    resume: resume.mutate,
    resuming: resume.isPending,
    dismissVisit: () => setLastVisit(null),
  };
}
