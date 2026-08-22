import { useState } from "react";
import { PageHeader, Workbench } from "@/shared/components";
import { Button, EmptyState, ErrorState, Icon, Panel, SectionHead, SkeletonLines, Stat, Tag, TextField } from "@/ui";
import { usd } from "@/shared/utils/format";
import { useOperatorAuth, useOperatorReadings } from "./hooks/useOperator";

export function OperatorScreen() {
  const token = useOperatorAuth((s) => s.token);
  const setToken = useOperatorAuth((s) => s.setToken);
  const clear = useOperatorAuth((s) => s.clear);
  const [draft, setDraft] = useState("");
  const { pool, providers, sessions, loading, error } = useOperatorReadings(token);

  if (!token) return <TokenGate value={draft} onChange={setDraft} onSubmit={() => setToken(draft.trim())} />;

  if (error) {
    return (
      <>
        <PageHeader title="Operator" />
        <Workbench narrow>
          <ErrorState
            title="The console refused that token"
            message={error.message}
            action={<Button variant="secondary" onClick={clear}>Enter a different token</Button>}
          />
        </Workbench>
      </>
    );
  }

  const sessionRows = sessions?.sessions ?? [];
  const columns = sessionRows.length > 0 ? Object.keys(sessionRows[0]) : [];

  return (
    <>
      <PageHeader title="Operator" sub="Pool, providers and metering health">
        {pool?.alert ? <Tag tone="risk">Headroom alert</Tag> : <Tag tone="ok">Headroom healthy</Tag>}
        <Button variant="ghost" size="sm" onClick={clear}>Sign out</Button>
      </PageHeader>

      <Workbench
        side={
          <>
            <span className="eyebrow">What is not here</span>
            <p className="body-sm dim" style={{ margin: 0 }}>
              No normaliser is applied to any figure on this console, and none will be invented. Weights are
              set by Grading Mode alone, so a per-Provider number is comparable to itself over time and to
              nothing else.
            </p>
            <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
              <span className="eyebrow">The float</span>
              <p className="caption mt-4">
                One-way: recoverable as service, not as cash. Divergence is the gap between the pool ledger and
                the sum of balances, and it should be zero.
              </p>
            </div>
          </>
        }
      >
        {loading ? (
          <SkeletonLines count={6} label="Reading the operator ledgers" />
        ) : (
          <>
            <p className="eyebrow">Internal</p>
            <h1 className="display-3 mt-4">Pool, spend, health.</h1>
            <p className="prose mt-6">
              Everything here reads off ledgers that already exist. Nothing a Candidate sees is derived from a
              different source than this one.
            </p>

            <div className="grid-4 readings-row mt-9">
              <Stat label="Pool" value={pool ? pool.pool.toLocaleString("en-US") : "—"} note="Credits issued into the system." />
              <Stat label="Sum of balances" value={pool ? pool.sum_balances.toLocaleString("en-US") : "—"} note="What Candidates still hold." />
              <Stat label="Headroom" value={pool ? pool.headroom.toLocaleString("en-US") : "—"} note="Pool less balances. Alerts below 150,000." />
              <Stat label="Float" value={pool ? usd(Math.round(pool.float_usd * 100)) : "—"} note="One-way. Recoverable as service, not cash." />
            </div>

            {pool && pool.divergence !== 0 ? (
              <Panel tone="2" pad={6} className="mt-8 rule-note" role="alert">
                <Icon name="info" size={16} />
                <p className="body-sm dim" style={{ margin: 0 }}>
                  The pool ledger and the sum of balances differ by {pool.divergence}. That is a bug in the
                  metering, not a rounding artefact — the two are written from the same events.
                </p>
              </Panel>
            ) : null}

            <section className="mt-11" aria-labelledby="providers">
              <SectionHead
                title="Per Provider"
                aside={providers ? `${(providers.unpriced_rate * 100).toFixed(1)}% of calls unpriced` : undefined}
              />
              {providers && providers.providers.length > 0 ? (
                <Panel style={{ overflow: "hidden" }}>
                  <div className="table-scroll">
                    <table className="table">
                      <caption className="visually-hidden">Spend and failure rate by Provider.</caption>
                      <thead>
                        <tr>
                          <th>Provider</th>
                          <th className="n" style={{ width: 90 }}>Visits</th>
                          <th className="n" style={{ width: 110 }}>Credits</th>
                          <th className="n" style={{ width: 130 }}>Per Visit</th>
                          <th className="n" style={{ width: 110 }}>Unpriced</th>
                          <th className="n" style={{ width: 110 }}>Failures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {providers.providers.map((p) => (
                          <tr key={p.provider}>
                            <td><span style={{ color: "var(--fg)" }}>{p.provider}</span></td>
                            <td className="n">{p.visits}</td>
                            <td className="n">{p.credits.toLocaleString("en-US")}</td>
                            <td className="n">{p.credits_per_visit}</td>
                            <td className="n">{(p.unpriced_rate * 100).toFixed(1)}%</td>
                            <td
                              className="n"
                              style={{ color: p.failure_rate > 0.05 ? "var(--risk)" : undefined }}
                            >
                              {(p.failure_rate * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ) : (
                <EmptyState title="No Provider has been metered yet" body="A row appears the first time a graded call is priced." />
              )}
            </section>

            <section className="mt-11" aria-labelledby="sessions">
              <SectionHead title="Sessions" aside={`${sessionRows.length} on record`} />
              {sessionRows.length > 0 ? (
                <Panel style={{ overflow: "hidden" }}>
                  <div className="table-scroll">
                    <table className="table">
                      <caption className="visually-hidden">Every Session the metering ledger knows about.</caption>
                      <thead>
                        <tr>{columns.map((c) => <th key={c}>{c.replace(/_/g, " ")}</th>)}</tr>
                      </thead>
                      <tbody>
                        {sessionRows.map((row, i) => (
                          <tr key={i}>
                            {columns.map((c) => (
                              <td key={c}>
                                <span className="cell-clip mono caption">{String(row[c] ?? "—")}</span>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ) : (
                <EmptyState title="No Session has been metered yet" />
              )}
            </section>
          </>
        )}
      </Workbench>
    </>
  );
}

function TokenGate({ value, onChange, onSubmit }: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <PageHeader title="Operator" sub="Authenticated separately from Candidate access" />
      <Workbench narrow>
        <div style={{ maxWidth: "44ch" }}>
          <p className="eyebrow">Internal</p>
          <h1 className="display-3 mt-4">This console is not yours by default.</h1>
          <p className="prose mt-6">
            Operator access is a separate credential from a Candidate&rsquo;s. It is held for this tab only and
            is never written to durable storage.
          </p>
          <form
            className="stack g-6 mt-9"
            onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          >
            <TextField
              label="Operator token"
              mono
              type="password"
              autoComplete="off"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              hint="Sent as x-operator-token on every read. Nothing is cached across tabs."
            />
            <Button variant="primary" type="submit" disabled={value.trim().length === 0}>
              Open the console
            </Button>
          </form>
        </div>
      </Workbench>
    </>
  );
}
