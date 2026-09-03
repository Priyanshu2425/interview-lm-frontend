import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";
import { useSessionHistory } from "@/shared/stores/sessionHistory";
import { useToast } from "@/shared/stores/toasts";
import { useSessionUser } from "@/shared/stores/session";
import type {
  QuestionPayload, SessionEnded, SessionParked, TranscriptMessage, TurnResult,
} from "@/shared/types";

export type TurnRole = "examiner" | "you" | "probe" | "hint";

/* One stream of turns, and nothing else.
   Since ISSUE-0042 nothing is graded while a Session runs, so there is no
   closed-Visit event to interleave and no score to place in the order it
   happened. The reading arrives once, in the report. */
export interface Turn {
  id: string;
  role: TurnRole;
  text: string;
}

const ROLE_OF: Record<string, TurnRole> = {
  question: "examiner",
  probe: "probe",
  hint: "hint",
};

/* The transcript labels a turn by who said it and what kind of thing it was.
   Both come off the row: the loop knew, and wrote it down. */
const ROLE_OF_MESSAGE = (m: TranscriptMessage): TurnRole =>
  m.role === "candidate" ? "you" : ROLE_OF[m.kind] ?? "examiner";

let turnSeq = 0;
const nextTurnId = () => `turn-${++turnSeq}`;

/* An answer, and how it arrived. Held together rather than as two refs because
   a retry has to resend both — the same key must converge on the same turn,
   and a turn that changed from spoken to typed on the way would be a different
   claim about what happened (ISSUE-0049). */
interface PendingAnswer {
  answer: string;
  spoken: boolean;
}

export interface ExaminationState {
  loading: boolean;
  /* The failure that stopped the read, rendered from the API's own message. */
  loadError: string | null;
  turns: Turn[];
  /* True after a reload that could not be filled in from the transcript. The
     exchange so far is on the record either way; saying so is more honest
     than an empty screen implying the question just began. */
  resumedMidQuestion: boolean;
  current: QuestionPayload | null;
  ended: SessionEnded | null;
  /* How many Topics the ending graded. Null while the Session is running, and
     on a Session that parked rather than ended — parking is not grading. */
  gradedCount: number | null;
  parked: SessionParked | null;
  sending: boolean;
  submitError: string | null;
  durationSeconds: number;
  paymentRoute: "credits" | "byok";
  /* Which fixed plan item is being asked, so the agenda can mark it. */
  planItemId: string | null;
  /* Every Topic the current question spans. A compressed item spans up to
     three, and naming one of them would be a lie about what is being asked. */
  topicTitles: string[];
  submit: (answer: string, spoken?: boolean) => void;
  retry: () => void;
  resume: () => void;
  resuming: boolean;
  ending: boolean;
  end: () => void;
}

export function useExamination(sessionId: string): ExaminationState {
  const queryClient = useQueryClient();
  const candidateId = useSessionUser() ?? "anonymous";
  const toast = useToast();
  const markEnded = useSessionHistory((s) => s.markEnded);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [current, setCurrent] = useState<QuestionPayload | null>(null);
  const [ended, setEnded] = useState<SessionEnded | null>(null);
  const [gradedCount, setGradedCount] = useState<number | null>(null);
  const [parked, setParked] = useState<SessionParked | null>(null);
  const [resumedMidQuestion, setResumedMidQuestion] = useState(false);

  /* One idempotency key per composed answer, reused on every retry. It only
     advances when a turn has actually landed, so a retry after a timeout
     converges on the same Answer Turn rather than opening a second one. */
  const turnIndex = useRef(0);
  const pendingAnswer = useRef<PendingAnswer | null>(null);

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
      setTurns([{
        id: nextTurnId(),
        role: ROLE_OF[pending.kind] ?? "examiner",
        text: pending.question,
      }]);
      setResumedMidQuestion(pending.turn > 1);
    }
    if (record.data.state === "ended") {
      setEnded({ session_id: sessionId, reason: record.data.ended_reason ?? "ended" });
    } else if (record.data.state === "parked" && !pending) {
      setParked({
        session_id: sessionId,
        code: record.data.parked_reason ?? "parked",
        message:
          "This Session stopped between questions. Nothing was lost — resuming opens the next one.",
        provider: record.data.provider ?? "",
        recoverable: true,
      });
    }
  }

  /* What was actually said, for a Session picked up mid-question.
     ISSUE-0042 made the transcript a thing the surface may read, so a reload
     restores the exchange rather than apologising for an empty screen. Asked
     for only in the case that needs it, and a failure is not an error: the
     caption below still tells the truth if this never answers. */
  const transcript = useQuery({
    queryKey: queryKeys.session.transcript(sessionId),
    queryFn: () => sessionService.transcript(sessionId),
    enabled: Boolean(sessionId) && resumedMidQuestion,
    staleTime: Infinity,
    retry: 1,
  });

  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  if (transcript.data && resumedMidQuestion && filledFrom !== sessionId) {
    setFilledFrom(sessionId);
    const said = transcript.data.messages;
    if (said.length > 0) {
      setTurns(said.map((m) => ({
        id: `msg-${m.seq}`,
        role: ROLE_OF_MESSAGE(m),
        text: m.text,
      })));
      setResumedMidQuestion(false);
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
      setEnded(result.payload);
      setCurrent(null);
      markEnded(sessionId);
      return;
    }
    const payload = result.payload;
    setTurns((prev) => [...prev, {
      id: nextTurnId(),
      role: ROLE_OF[payload.kind] ?? "examiner",
      text: payload.question,
    }]);
    setCurrent(payload);
  }, [markEnded, sessionId]);

  const turn = useMutation({
    mutationFn: (pending: PendingAnswer) =>
      sessionService.submitTurn(
        sessionId, pending.answer, turnIndex.current, pending.spoken,
      ),
    onSuccess: (result) => {
      turnIndex.current += 1;
      pendingAnswer.current = null;
      apply(result);
      /* Spend moved, and an item's state may have flipped `planned` to
         `asked` — the agenda is read off the server and must follow. */
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.spend(sessionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session.plan(sessionId) });
      /* Not the Candidate's confidence: nothing is graded until the Session
         ends, so no posterior moved and the mastery map has not changed. */
    },
  });

  /* Grading happens at the end, so this is the moment every reading appears.
     Both are expired here and nowhere else in the loop. */
  const onSessionOver = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.session.report(sessionId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.candidate.confidence(candidateId) });
  }, [queryClient, sessionId, candidateId]);

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

  /* Ending is also grading (ISSUE-0044), and it answers in three ways.
     A question still being asked finishes first and nothing has happened yet;
     a Session that is over is graded; a Session that parked is *not*, because
     topping up resumes it and a Beta observation would be written for
     material the Candidate is about to be asked more about. */
  const end = useMutation({
    mutationFn: () => sessionService.end(sessionId),
    onSuccess: (result) => {
      if ("note" in result) {
        toast({ title: "Ending after this question", body: result.note });
        return;
      }
      if (result.state === "parked") {
        setParked({
          session_id: sessionId,
          code: result.reason,
          message:
            "This Session is waiting rather than finished, so it has not been graded.",
          provider: record.data?.provider ?? "",
          recoverable: true,
        });
        setCurrent(null);
        return;
      }
      setGradedCount(result.graded);
      setEnded({ session_id: sessionId, reason: result.reason });
      setCurrent(null);
      markEnded(sessionId);
      onSessionOver();
    },
    onError: (error: Error) => {
      toast({ title: "The Session was not ended", body: error.message, tone: "risk" });
    },
  });

  /* The graph grades on its own edge to END, so a Session that ran out of
     plan or clock is graded without anybody calling `/end`. */
  useEffect(() => {
    if (endedReason) onSessionOver();
  }, [endedReason, onSessionOver]);

  /* `spoken` says the text is a transcription rather than something typed. It
     stays true even when the Candidate corrected the transcript before sending
     — it is still a machine's reading of a voice, which is the question the
     flag exists to answer (ISSUE-0049). Defaulted, so the typing composer's
     call site is unchanged. */
  const submit = useCallback((answer: string, spoken = false) => {
    const text = answer.trim();
    if (!text) return;
    pendingAnswer.current = { answer: text, spoken };
    setTurns((prev) => [...prev, { id: nextTurnId(), role: "you", text }]);
    turn.mutate(pendingAnswer.current);
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

  const topicTitles = useMemo(() => {
    if (!current) return [];
    const spanned = current.topic_titles ?? [];
    return spanned.length > 0 ? spanned : [current.topic_title].filter(Boolean);
  }, [current]);

  return {
    loading: record.isPending,
    loadError: record.error ? (record.error as Error).message : null,
    turns,
    resumedMidQuestion,
    current,
    ended,
    gradedCount,
    parked,
    sending: turn.isPending,
    submitError,
    durationSeconds: record.data?.duration_seconds ?? 0,
    paymentRoute: record.data?.payment_route ?? "credits",
    planItemId: current?.plan_item_id || null,
    topicTitles,
    submit,
    retry,
    resume: resume.mutate,
    resuming: resume.isPending,
    ending: end.isPending,
    end: end.mutate,
  };
}
