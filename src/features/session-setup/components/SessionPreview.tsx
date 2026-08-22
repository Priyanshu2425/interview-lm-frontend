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
          knowable before it runs. You see the real number after every Topic.
        </p>
      </Panel>

      <Button
        variant="primary"
        size="lg"
        full
        onClick={onBegin}
        disabled={Boolean(blocked)}
        loading={starting}
        loadingLabel="Opening the first Topic…"
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
