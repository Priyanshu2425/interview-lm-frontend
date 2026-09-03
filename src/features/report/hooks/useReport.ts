import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { candidateService } from "@/lib/services/candidate";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { useSessionUser } from "@/shared/stores/session";
import type { ReportTopic, SessionReport, Spend } from "@/shared/types";

/** One reached Topic, with what it cost.
 *
 *  Cost is the only thing joined in: the report already carries the title, the
 *  module, who graded it, how many questions touched it and the spans behind
 *  them. There is no `turn_count` join any more, and no third read to make it. */
export interface ReportRow extends ReportTopic {
  credits: number | null;
}

export interface ReportView {
  loading: boolean;
  error: string | null;
  report: SessionReport | undefined;
  spend: Spend | undefined;
  rows: ReportRow[];
}

/* Two reads, issued together: the reading and the ledger do not depend on each
   other, and waterfalling them would add a round-trip for nothing. */
export function useReport(sessionId: string): ReportView {
  const [reportQ, spendQ] = useQueries({
    queries: [
      {
        queryKey: queryKeys.session.report(sessionId),
        queryFn: () => sessionService.report(sessionId),
        enabled: Boolean(sessionId),
      },
      {
        queryKey: queryKeys.session.spend(sessionId),
        queryFn: () => sessionService.spend(sessionId),
        enabled: Boolean(sessionId),
      },
    ],
  });

  const rows = useMemo<ReportRow[]>(() => {
    const report = reportQ.data;
    if (!report) return [];

    /* Index once, then look up — the alternative is a nested scan per row.
       Keyed by `topic_id` rather than by Visit: one question spanning three
       Topics writes three Evidence rows against a single `topic_visit_id`. */
    const creditsByTopic = new Map<string, number>();
    for (const v of spendQ.data?.per_visit ?? []) {
      if (v.credits === null) continue;
      creditsByTopic.set(v.topic_id, (creditsByTopic.get(v.topic_id) ?? 0) + v.credits);
    }

    return report.topics.map((t) => ({
      ...t,
      credits: creditsByTopic.has(t.topic_id) ? creditsByTopic.get(t.topic_id)! : null,
    }));
  }, [reportQ.data, spendQ.data]);

  return {
    loading: reportQ.isPending,
    error: reportQ.error ? (reportQ.error as Error).message : null,
    report: reportQ.data,
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
  const candidateId = useSessionUser() ?? "anonymous";
  return useQuery({
    queryKey: queryKeys.candidate.topicStanding(candidateId, topicId ?? ""),
    queryFn: () => candidateService.topicStanding(topicId as string),
    enabled: Boolean(candidateId && topicId),
  });
}
