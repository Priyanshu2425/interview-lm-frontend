import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/shared/components";
import { CostValue, Panel, SkeletonLines } from "@/ui";
import { sessionService } from "@/lib/services/sessions";
import { queryKeys } from "@/lib/query-keys";
import { useLatestRunningSession } from "@/shared/stores/sessionHistory";

/* The rail's footer carries the one number a Candidate mid-Session actually
   wants at a glance: what this Session has cost so far. It is absent rather
   than zero when there is no Session, and an em dash rather than a figure on
   a route that does not spend Credits. */
function RailSpend() {
  const running = useLatestRunningSession();
  const { data } = useQuery({
    queryKey: queryKeys.session.spend(running?.id ?? "none"),
    queryFn: () => sessionService.spend(running!.id),
    enabled: Boolean(running?.id),
    refetchInterval: 45_000,
  });

  if (!running || !data) return null;

  return (
    <Panel tone="2" pad={5} className="stack g-4">
      <span className="eyebrow">This Session</span>
      <CostValue value={data.credits} route={data.route} unit="metered" />
      <span className="caption">
        {data.per_visit.length} question{data.per_visit.length === 1 ? "" : "s"}
        {data.route === "byok" ? " · your own key" : ""}
      </span>
    </Panel>
  );
}

export function RootLayout() {
  return (
    <AppShell railFooter={<RailSpend />}>
      <Suspense fallback={<div className="workbench-main"><SkeletonLines count={4} label="Loading" /></div>}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
