import type { Scope } from "@/shared/types";
import { Button, CostUnknown, Panel, Skeleton, Tag } from "@/ui";
import { GRADING_MODE_SHORT, duration as fmtDuration } from "@/shared/utils/format";

interface PreviewProps {
  scope: Scope | undefined;
  loadingScope: boolean;
  moduleCount: number;
  durationSeconds: number;
  provider: string;
  onBegin: () => void;
  starting: boolean;
  blocked: string | null;
}

/* What the Session will be, before it is one. Everything here is a count the
   server returned; nothing is a forecast. */
export function SessionPreview({
  scope, loadingScope, moduleCount, durationSeconds, provider, onBegin, starting, blocked,
}: PreviewProps) {
  const rows: [string, React.ReactNode][] = [
    ["Modules in scope", moduleCount === 0 ? "—" : `${moduleCount}`],
    ["Topics eligible", loadingScope ? <Skeleton width={40} height={12} /> : (scope?.topic_count ?? "—")],
    [
      "With an Answer Key",
      loadingScope ? <Skeleton width={40} height={12} /> : (scope?.ground_truth_topic_count ?? "—"),
    ],
    ["Duration", fmtDuration(durationSeconds)],
  ];

  /* Read off Topic count and nothing else (ISSUE-0040). Not from how much
     text a Topic holds: "more words so it needs longer" is a difficulty
     reading wearing a clock's clothes, and difficulty is not a property this
     product records. A time is neither a difficulty nor a cost. */
  const pacing: [string, React.ReactNode, string][] = scope && scope.topic_count > 0
    ? [
        [
          "Questions at full coverage",
          scope.questions_at_full_coverage,
          "One question per Topic in scope.",
        ],
        [
          "Suggested",
          fmtDuration(scope.suggested_seconds),
          "Long enough to ask every Topic its own question.",
        ],
        [
          "Minimum",
          fmtDuration(scope.minimum_seconds),
          "Below this, some Topic goes unexamined however the Session is planned.",
        ],
      ]
    : [];

  /* A statement, not a validation error. A short clock is a legitimate choice
     that buys a compressed plan; whether it *is* compressed is the server's
     word, and it arrives with the plan rather than being guessed at here. */
  const tight = Boolean(
    scope && scope.topic_count > 0 && durationSeconds < scope.minimum_seconds,
  );

  return (
    <>
      <span className="eyebrow">Session preview</span>

      <div className="stack g-5">
        {rows.map(([label, value]) => (
          <div className="between" key={label}>
            <span className="body-sm dim">{label}</span>
            <strong className="mono">{value}</strong>
          </div>
        ))}
      </div>

      {pacing.length > 0 ? (
        <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
          <span className="eyebrow">What this scope needs</span>
          <div className="stack g-5 mt-4">
            {pacing.map(([label, value]) => (
              <div className="between" key={label}>
                <span className="body-sm dim">{label}</span>
                <strong className="mono">{value}</strong>
              </div>
            ))}
          </div>
          <p className="caption mt-4">{pacing[pacing.length - 1][2]}</p>
          {tight ? (
            <Panel tone="2" pad={6} className="stack g-4 mt-5">
              <p className="body-sm dim" style={{ margin: 0 }}>
                This clock cannot reach every Topic in this scope. The plan will group
                Topics into shared questions, and some may go unasked — which is recorded
                as unasked, never as a zero.
              </p>
            </Panel>
          ) : null}
        </div>
      ) : null}

      <div className="hair-t" style={{ paddingTop: "var(--s-6)" }}>
        <div className="stack g-5">
          <div className="between">
            <span className="body-sm dim">Strongest grading</span>
            {scope?.strongest_mode ? (
              <Tag tone={scope.strongest_mode === "ground_truth" ? "ok" : "neutral"}>
                {GRADING_MODE_SHORT[scope.strongest_mode]}
              </Tag>
            ) : (
              <span className="caption">Choose a Module</span>
            )}
          </div>
          <div className="between">
            <span className="body-sm dim">Provider</span>
            <Tag tone="neutral">{provider}</Tag>
          </div>
        </div>
        <p className="caption mt-5">
          A missing Answer Key lowers the weight of the evidence. It never makes the material unusable.
        </p>
      </div>

      <Panel tone="2" pad={6} className="stack g-4">
        <span className="eyebrow">Cost</span>
        <CostUnknown>Not quoted before it is knowable.</CostUnknown>
        <p className="caption" style={{ margin: 0 }}>
          Topic material varies more than four-fold and you choose the duration, so a Session total is not
          knowable before it runs. You see the real number in the report.
        </p>
      </Panel>

      <Button
        variant="primary"
        size="lg"
        full
        onClick={onBegin}
        disabled={Boolean(blocked)}
        loading={starting}
        loadingLabel="Planning the Session…"
        title={blocked ?? undefined}
      >
        Begin Session
      </Button>
      <p className="caption" style={{ textAlign: "center", margin: 0 }}>
        {blocked ?? "Resumable at any point."}
      </p>
    </>
  );
}
