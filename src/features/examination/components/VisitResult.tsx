import type { PaymentRoute, VisitClosed } from "@/shared/types";
import { BetaCurve, Coverage, CostValue, Dial, Panel, Reading, Tag } from "@/ui";
import { bandClass } from "@/shared/utils/band";
import { GRADING_MODE_LABEL, GRADING_MODE_WEIGHT } from "@/shared/utils/format";

/* One Visit, one score. The only moment in the product allowed to take a beat:
   the dial fills and the posterior deforms out of the prior it updated. */
export function VisitResult({ visit, route, credits, ended }: {
  visit: VisitClosed;
  route: PaymentRoute;
  credits: number | null;
  ended: boolean;
}) {
  const prior = {
    alpha: Math.max(1, visit.alpha - visit.score * visit.weight),
    beta: Math.max(1, visit.beta - (1 - visit.score) * visit.weight),
  };

  return (
    <Panel pad={7} className={`visit-result ${bandClass(visit.band)}`}>
      <div className="between visit-result-head">
        <div>
          <span className="eyebrow">Topic Visit closed</span>
          <h2 className="h3 mt-3">{visit.topic_title || visit.topic_id}</h2>
        </div>
        <Dial value={visit.score} band={visit.band} label={visit.topic_title || visit.topic_id} />
      </div>

      {visit.rationale ? (
        <p className="body-sm dim visit-result-why">{visit.rationale}</p>
      ) : null}

      <div className="visit-result-grid">
        <div className="stack g-5">
          <span className="eyebrow">Where the Topic stands now</span>
          <BetaCurve
            alpha={visit.alpha}
            beta={visit.beta}
            band={visit.band}
            label={visit.band_label}
            mastery={visit.mastery}
            from={prior}
            width={300}
            height={80}
          />
          <div className="between">
            <Reading band={visit.band} label={visit.band_label} mastery={visit.mastery} />
            <Coverage value={visit.coverage} />
          </div>
        </div>

        <div className="stack g-5">
          <span className="eyebrow">On the Evidence row</span>
          <dl className="judge-in">
            <dt>graded</dt><dd>{GRADING_MODE_LABEL[visit.grading_mode]}</dd>
            <dt>weight</dt><dd>{GRADING_MODE_WEIGHT[visit.grading_mode]}</dd>
            <dt>grader</dt><dd>{visit.grader}</dd>
            <dt>provider</dt><dd>{visit.provider}</dd>
            <dt>rubric</dt><dd>{visit.rubric_version}</dd>
          </dl>
          <div className="row g-4" style={{ flexWrap: "wrap" }}>
            <Tag tone="judge">Blind grade</Tag>
            <CostValue value={credits} route={route} unit="this Visit" />
          </div>
        </div>
      </div>

      {visit.recovered ? (
        <p className="caption">
          This answer was submitted before the connection dropped. It was already on the record, so it was
          graded rather than discarded.
        </p>
      ) : null}

      {ended ? (
        <p className="caption" style={{ margin: 0 }}>
          The last Visit of this Session, examined to the end and scored.
        </p>
      ) : null}
    </Panel>
  );
}
