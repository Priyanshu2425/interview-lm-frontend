import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { candidateService } from "@/lib/services/candidate";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { useCandidateId } from "@/shared/stores/identity";
import type { Citation, GradingMode, SessionSummary, Spend, TopicReading } from "@/shared/types";

export interface EvidenceRow extends TopicReading {
  title: string;
  moduleTitle: string;
  gradedBy: GradingMode | null;
  citations: Citation[];
  turnCount: number | null;
  credits: number | null;
}

export interface SessionRecordView {
  loading: boolean;
  error: string | null;
  summary: SessionSummary | undefined;
  spend: Spend | undefined;
  rows: EvidenceRow[];
}

/* Three reads, issued together rather than one after another: the summary,
   the spend ledger and the Session itself do not depend on each other, and
   waterfalling them would add two round-trips for nothing. */
export function useSessionRecord(sessionId: string): SessionRecordView {
  const [summaryQ, spendQ, recordQ] = useQueries({
    queries: [
      {
        queryKey: queryKeys.session.summary(sessionId),
        queryFn: () => sessionService.summary(sessionId),
        enabled: Boolean(sessionId),
      },
      {
        queryKey: queryKeys.session.spend(sessionId),
        queryFn: () => sessionService.spend(sessionId),
        enabled: Boolean(sessionId),
      },
      {
        queryKey: queryKeys.session.one(sessionId),
        queryFn: () => sessionService.get(sessionId),
        enabled: Boolean(sessionId),
      },
    ],
  });

  const rows = useMemo<EvidenceRow[]>(() => {
    const summary = summaryQ.data;
    if (!summary) return [];

    /* Index once, then look up — the alternative is a nested scan per row. */
    const creditsByTopic = new Map<string, number>();
    for (const v of spendQ.data?.per_visit ?? []) {
      if (v.credits === null) continue;
      creditsByTopic.set(v.topic_id, (creditsByTopic.get(v.topic_id) ?? 0) + v.credits);
    }
    const turnsByTopic = new Map<string, number>();
    for (const v of recordQ.data?.visits ?? []) {
      turnsByTopic.set(v.topic_id, (turnsByTopic.get(v.topic_id) ?? 0) + v.turn_count);
    }

    return summary.per_topic.map((t) => ({
      ...t,
      moduleTitle: t.module_title,
      gradedBy: t.graded_by,
      turnCount: turnsByTopic.get(t.topic_id) ?? null,
      credits: creditsByTopic.has(t.topic_id) ? creditsByTopic.get(t.topic_id)! : null,
    }));
  }, [summaryQ.data, spendQ.data, recordQ.data]);

  return {
    loading: summaryQ.isPending,
    error: summaryQ.error ? (summaryQ.error as Error).message : null,
    summary: summaryQ.data,
    spend: spendQ.data,
    rows,
  };
}


/* Where the Candidate stands on one Topic (ADR-0022).

   `enabled` is the placement, not an optimisation: the standing is fetched when
   a Candidate opens one Topic's drawer and never for the table. A rank that
   arrives with every row is a column, a column can be scanned, and a scannable
   column of ranks is an order over Topics — which is Topic recommendation by
   another name. */
export function useTopicStanding(topicId: string | null) {
  const candidateId = useCandidateId();
  return useQuery({
    queryKey: queryKeys.candidate.topicStanding(candidateId, topicId ?? ""),
    queryFn: () => candidateService.topicStanding(candidateId, topicId as string),
    enabled: Boolean(candidateId && topicId),
  });
}
