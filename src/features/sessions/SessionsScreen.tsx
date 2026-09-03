import { useMemo } from "react";
import { PageHeader, Workbench } from "@/shared/components";
import { ButtonLink, EmptyState, ErrorState, Panel, SkeletonLines } from "@/ui";
import { useModules } from "@/features/session-setup";
import type { SessionListing } from "@/shared/types";
import { openSession, useSessions } from "./hooks/useSessions";
import { OpenSessionCard } from "./components/OpenSessionCard";
import { SessionTable } from "./components/SessionTable";

export function SessionsScreen() {
  const { data: sessions, isPending, error } = useSessions();
  const { data: modules } = useModules();

  /* A Session records the Module ids it was scoped to; the names live with
     the Modules. Where a Module has since been retired its id stands in —
     Evidence outlives the material, so a Session must still be nameable. */
  const nameOf = useMemo(() => {
    const byId = new Map((modules ?? []).map((m) => [m.module_id, m.title]));
    return (s: SessionListing) => {
      const names = s.module_ids.map((id) => byId.get(id) ?? id);
      if (names.length === 0) return "No scope recorded";
      if (names.length <= 2) return names.join(" · ");
      return `${names.slice(0, 2).join(" · ")} +${names.length - 2}`;
    };
  }, [modules]);

  const open = openSession(sessions);
  const rest = (sessions ?? []).filter((s) => s !== open);

  const start = (
    <ButtonLink to="/session/new" variant="primary" size="sm">
      Start a Session
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        title="Session"
        sub={sessions?.length ? `${sessions.length} sat` : undefined}
      >
        {start}
      </PageHeader>

      <Workbench>
        {error ? (
          <ErrorState
            title="Your Sessions could not be read"
            message={(error as Error).message}
          />
        ) : isPending ? (
          <SkeletonLines count={4} label="Reading your Sessions" />
        ) : sessions && sessions.length > 0 ? (
          <>
            {open ? (
              <div className="mt-0">
                <OpenSessionCard session={open} scope={nameOf(open)} />
              </div>
            ) : null}

            <section className={open ? "mt-11" : ""}>
              <div className="between" style={{ alignItems: "baseline" }}>
                <h2 className="h2">The record</h2>
                <span className="caption">Newest first</span>
              </div>
              {rest.length === 0 ? (
                <p className="caption mt-6">
                  Nothing else yet. The Session above is your first.
                </p>
              ) : (
                <Panel className="mt-5" style={{ overflow: "hidden" }}>
                  <SessionTable sessions={rest} scopeOf={nameOf} />
                </Panel>
              )}
              <p className="caption mt-5" style={{ maxWidth: "72ch" }}>
                Topics measured is a count of Evidence rows, not a score. A Topic a
                Session never reached has none — it is unasked, which is a different
                fact from answered badly. There is no figure for a Session as a whole:
                the reading is per Topic, and it is in the report.
              </p>
            </section>
          </>
        ) : (
          <EmptyState
            icon="visit"
            title="No Session yet"
            body="Reading is not preparation. Choose the Modules you want examined on and how long you have, and the plan is fixed before the first question."
            action={
              <ButtonLink to="/session/new" variant="primary">
                Start a Session
              </ButtonLink>
            }
          />
        )}
      </Workbench>
    </>
  );
}
