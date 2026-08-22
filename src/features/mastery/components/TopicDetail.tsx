import type { TopicReading } from "@/shared/types";
import { BetaCurve, ButtonLink, Coverage, EmptyState, Panel, Reading } from "@/ui";
import { bandClass } from "@/shared/utils/band";

export function TopicDetail({ topic }: { topic: TopicReading | null }) {
  if (!topic) {
    return (
      <EmptyState
        icon="probe"
        title="Pick a Topic"
        body="Its distribution, its evidence count, and what the two of them together do and do not license you to say."
      />
    );
  }

  const untested = topic.band === "untested";
  return (
    <div className={`stack g-6 ${bandClass(topic.band)}`}>
      <div>
        <span className="eyebrow">Topic Confidence</span>
        <h2 className="h3 mt-3">{topic.title ?? topic.topic_id}</h2>
      </div>

      <BetaCurve
        alpha={topic.alpha}
        beta={topic.beta}
        band={topic.band}
        label={topic.label}
        mastery={topic.mastery}
        width={300}
        height={92}
      />

      <div className="between">
        <Reading band={topic.band} label={topic.label} mastery={topic.mastery} />
        <Coverage value={topic.coverage} />
      </div>

      <Panel tone="2" pad={6} className="stack g-5">
        <div className="between">
          <span className="body-sm dim">Coverage</span>
          <strong className="mono">{topic.coverage.toFixed(2)} effective visits</strong>
        </div>
        <div className="between">
          <span className="body-sm dim">Mastery</span>
          <strong className="mono">{topic.mastery === null ? "—" : topic.mastery.toFixed(2)}</strong>
        </div>
        <div className="between">
          <span className="body-sm dim">Credible interval</span>
          <strong className="mono">
            {topic.interval === null
              ? "—"
              : `${topic.interval[0].toFixed(2)} – ${topic.interval[1].toFixed(2)}`}
          </strong>
        </div>
        <p className="caption" style={{ margin: 0 }}>
          {untested
            ? "Below the Evidence Floor. There is no call that returns a Mastery number for this Topic, and none will be invented here."
            : "Coverage is the evidence count and Mastery is the centre of the distribution. They are reported separately and never fused."}
        </p>
      </Panel>

      <ButtonLink to="/session/new" variant="secondary" full>
        Examine this area again
      </ButtonLink>
    </div>
  );
}
