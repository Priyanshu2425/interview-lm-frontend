import type { VisitClosed } from "@/shared/types";
import { BetaCurve, Coverage, EmptyState, Panel, Reading } from "@/ui";
import { bandClass } from "@/shared/utils/band";

/* Where the Topic stands, and what the last graded answer did to it. The
   prior is reconstructed from the posterior and the score the server
   returned — not re-derived: alpha and beta both arrive on the row, and one
   graded answer is exactly one unit of evidence. */
export function ConfidencePanel({ visit, topicTitle }: {
  visit: VisitClosed | null;
  topicTitle: string | undefined;
}) {
  if (!visit) {
    return (
      <EmptyState
        icon="floor"
        title={topicTitle ? `${topicTitle} has no reading yet this Visit` : "No reading yet"}
        body="One Visit yields exactly one score and exactly one write, however many answers it contained. The curve moves when the Visit closes."
      />
    );
  }

  const prior = {
    alpha: Math.max(1, visit.alpha - visit.score * visit.weight),
    beta: Math.max(1, visit.beta - (1 - visit.score) * visit.weight),
  };

  return (
    <div className={`stack g-6 ${bandClass(visit.band)}`}>
      <span className="eyebrow">{visit.topic_title || topicTitle} · after this Visit</span>
      <BetaCurve
        alpha={visit.alpha}
        beta={visit.beta}
        band={visit.band}
        label={visit.band_label}
        mastery={visit.mastery}
        from={prior}
        width={300}
        height={88}
      />
      <div className="between">
        <Reading band={visit.band} label={visit.band_label} mastery={visit.mastery} />
        <Coverage value={visit.coverage} />
      </div>
      <Panel tone="2" pad={6}>
        <p className="body-sm dim" style={{ margin: 0 }}>
          {visit.mastery === null
            ? "Still below the Evidence Floor. Coverage and Mastery are reported separately, and there is no number to show for this Topic yet — an unasked Topic is not a low score."
            : "Coverage is the evidence count; Mastery is the centre of the distribution. They are two readings and are never fused into one figure."}
        </p>
      </Panel>
    </div>
  );
}
