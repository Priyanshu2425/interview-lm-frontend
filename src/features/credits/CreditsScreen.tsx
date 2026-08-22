import { useState } from "react";
import { PageHeader, Workbench } from "@/shared/components";
import {
  Button, ButtonLink, Dialog, EmptyState, ErrorState, Icon, Panel, SectionHead, SkeletonLines, Stat, Tag,
  TextField,
} from "@/ui";
import { credits as fmtCredits, relativeTime, usd } from "@/shared/utils/format";
import { useCredits, useKeyMutations, usePrices } from "./hooks/useCredits";

/* The ledger's own vocabulary, in the Candidate's terms. An unmapped type is
   shown as itself rather than guessed at — a wrong label on a money row is
   worse than a raw one. */
const ENTRY_LABEL: Record<string, string> = {
  grant: "Payment cleared",
  promo_grant: "Credit granted",
  debit: "Metered call",
  refund: "Refunded",
};

export function CreditsScreen() {
  const { data, isPending, error } = useCredits();
  const { data: prices } = usePrices();
  const { attach, revoke } = useKeyMutations();
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [revokeOpen, setRevokeOpen] = useState(false);

  if (error) {
    return (
      <>
        <PageHeader title="Credits" />
        <Workbench><ErrorState title="The ledger could not be read" message={(error as Error).message} /></Workbench>
      </>
    );
  }

  const byok = data?.byok ?? null;
  const route = data?.route ?? "credits";

  return (
    <>
      <PageHeader title="Credits" sub="One Credit is one US cent of provider cost">
        <Tag tone={route === "byok" ? "accent" : "neutral"}>
          {route === "byok" ? "On your own key" : "On Credits"}
        </Tag>
      </PageHeader>

      <Workbench
        narrow
        side={
          <>
            <span className="eyebrow">Which ledger you are on</span>
            <p className="body-sm dim" style={{ margin: 0 }}>
              {route === "byok"
                ? "Your OpenRouter key is attached, so your Provider bills you directly. No Credits are spent, and none are shown — a zero here would read as “it was free” rather than “this ledger does not apply to you”."
                : "Sessions and notebook ingest are metered against your Credit balance, in real cents, per graded call."}
            </p>

            {byok ? (
              <Panel tone="2" pad={6} className="stack g-5">
                <span className="eyebrow">Attached key</span>
                <div className="between">
                  <span className="body-sm dim">Fingerprint</span>
                  <strong className="mono">{byok.fingerprint}</strong>
                </div>
                <div className="between">
                  <span className="body-sm dim">Status</span>
                  <Tag tone={byok.status === "active" ? "ok" : "warn"}>{byok.status}</Tag>
                </div>
                <div className="between">
                  <span className="body-sm dim">Credits spent</span>
                  <strong className="mono">—</strong>
                </div>
                <Button variant="danger" size="sm" onClick={() => setRevokeOpen(true)}>
                  Revoke this key
                </Button>
              </Panel>
            ) : (
              <Panel tone="2" pad={6} className="stack g-5">
                <span className="eyebrow">Bring your own key</span>
                <p className="body-sm dim" style={{ margin: 0 }}>
                  Attach an OpenRouter key and your Provider bills you directly. Nothing changes about the
                  examination — the same graph, the same blind Judge, the same Evidence rows.
                </p>
                <Button variant="secondary" size="sm" onClick={() => setKeyOpen(true)}>
                  <Icon name="key" size={14} />
                  Attach a key
                </Button>
              </Panel>
            )}

            {/* Provider price history is a Credit figure, so it is a Credits
                view. A Candidate on their own key must never be shown one —
                not even someone else's average — because the number would
                imply a ledger they are not on. */}
            {prices && route === "credits" ? (
              <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
                <span className="eyebrow">What a Topic has cost</span>
                <div className="stack g-4 mt-4">
                  {prices.prices.length === 0 ? (
                    <p className="caption" style={{ margin: 0 }}>
                      No Topic has been graded on this account yet, so there is no history to report.
                    </p>
                  ) : (
                    prices.prices.map((p) => (
                      <div className="between" key={p.provider}>
                        <span className="body-sm dim">{p.provider}</span>
                        <span className="mono">
                          {p.credits_per_visit} Cr
                          <span className="caption"> · {p.observed_visits} visits</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <p className="caption mt-5">{prices.why}</p>
              </div>
            ) : null}
          </>
        }
      >
        {isPending ? (
          <SkeletonLines count={5} label="Reading your ledger" />
        ) : (
          <>
            <p className="eyebrow">Metering</p>
            <h1 className="display-3 mt-4">
              {route === "byok" ? "You are on your own key." : "Where the money went."}
            </h1>
            <p className="prose mt-6">
              Cost is shown, not hidden. Every graded call names its Provider and what it cost, and a Visit
              that has already started runs to the end even on an exhausted balance — the permanent write wins
              over the billing check.
            </p>

            {route === "credits" ? (
              <>
                <div className="grid-3 readings-row mt-9">
                  <Stat
                    label="Balance"
                    value={fmtCredits(data?.balance ?? null, "credits")}
                    note="One Credit is one US cent of provider cost."
                  />
                  <Stat
                    label="In dollars"
                    value={usd(data?.balance ?? null)}
                    note="The same number, in the unit you paid in."
                  />
                  <Stat
                    label="Entries"
                    value={data?.ledger.length ?? 0}
                    note="Grants and charges, oldest to newest."
                  />
                </div>

                {data?.low_balance ? (
                  <Panel tone="2" pad={6} className="mt-8 rule-note" role="status">
                    <Icon name="info" size={16} />
                    <div>
                      <strong className="body-sm">The balance is getting low</strong>
                      <p className="body-sm dim" style={{ margin: "var(--s-3) 0 0" }}>
                        A Session that runs out parks at the Topic boundary rather than being cut off
                        mid-answer, and resumes where it stopped. Attaching your own key removes the limit
                        entirely.
                      </p>
                    </div>
                  </Panel>
                ) : null}

                <section className="mt-11" aria-labelledby="ledger">
                  <SectionHead title="Ledger" aside="Nothing here is estimated" />
                  {data && data.ledger.length > 0 ? (
                    <Panel style={{ overflow: "hidden" }}>
                      <div className="table-scroll">
                        <table className="table table--ledger">
                          <caption className="visually-hidden">
                            Every Credit movement on this account, newest first.
                          </caption>
                          <thead>
                            <tr>
                              <th>Entry</th>
                              <th style={{ width: 220 }}>Topic Visit</th>
                              <th style={{ width: 150 }}>When</th>
                              <th style={{ width: 110 }} className="n">Credits</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...data.ledger].reverse().map((row, i) => (
                              <tr key={`${row.created_at}-${i}`}>
                                <td>
                                  <span style={{ color: "var(--fg)" }}>
                                    {ENTRY_LABEL[row.entry_type] ?? row.entry_type}
                                  </span>
                                </td>
                                <td>
                                  <span className="cell-clip mono caption">{row.topic_visit_id ?? "—"}</span>
                                </td>
                                <td><span className="caption">{relativeTime(row.created_at)}</span></td>
                                <td className="n" style={{ color: row.delta_credits > 0 ? "var(--ok)" : "var(--fg-2)" }}>
                                  {row.delta_credits > 0 ? "+" : ""}{row.delta_credits}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                  ) : (
                    <EmptyState
                      icon="cost"
                      title="Nothing has been metered yet"
                      body="A charge appears when a Topic Visit is graded, or when a notebook Source is embedded."
                      action={<ButtonLink to="/session/new" variant="primary">Start a Session</ButtonLink>}
                    />
                  )}
                </section>

                <p className="caption mt-6">
                  Payment processing is not part of this build. Credits are granted when a payment clears, and
                  the grant lands here as its own entry.
                </p>
              </>
            ) : (
              <div className="mt-9">
                <EmptyState
                  icon="key"
                  title="There is no Credit ledger on this account"
                  body="Your key pays your Provider directly, so there is nothing to meter here. Cost and provenance still appear on every Evidence row — that is a property of the record, not of who paid."
                  action={<ButtonLink to="/evidence" variant="primary">See the Evidence</ButtonLink>}
                />
              </div>
            )}
          </>
        )}
      </Workbench>

      <Dialog
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        title="Attach an OpenRouter key"
        footer={
          <>
            <Button variant="ghost" onClick={() => setKeyOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              data-autofocus
              disabled={keyValue.trim().length === 0}
              loading={attach.isPending}
              onClick={() => {
                attach.mutate(keyValue.trim(), { onSuccess: () => { setKeyOpen(false); setKeyValue(""); } });
              }}
            >
              Attach it
            </Button>
          </>
        }
      >
        <div className="stack g-6">
          <p style={{ margin: 0 }}>
            The key is encrypted at rest and only one component can decrypt it. It is never sent to the
            browser again, and the client never grades — a key attached here pays for calls the server makes.
          </p>
          <TextField
            label="OpenRouter key"
            mono
            type="password"
            autoComplete="off"
            placeholder="sk-or-…"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            hint="OpenRouter keys only. Anything else is refused by name rather than failing quietly later."
          />
        </div>
      </Dialog>

      <Dialog
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
        title="Revoke this key?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeOpen(false)}>Keep it attached</Button>
            <Button
              variant="danger"
              data-autofocus
              loading={revoke.isPending}
              onClick={() => {
                if (byok) revoke.mutate(byok.key_id, { onSuccess: () => setRevokeOpen(false) });
              }}
            >
              Revoke it
            </Button>
          </>
        }
      >
        New Sessions go back onto Credits. A Session already running keeps the route it started with, because
        changing which ledger pays halfway through would split one record across two of them.
      </Dialog>
    </>
  );
}
