import type { VisitClosed } from "@/shared/types";
import { EmptyState, Icon, Tag } from "@/ui";
import { GRADING_MODE_LABEL, GRADING_MODE_WEIGHT } from "@/shared/utils/format";

/* Achromatic by token, and it stays that way. Sycophancy is not a prompt
   defect — it is conversational context working as intended — so the grader
   is a separate blind call, and its surface is denied the accent that
   everything else in the product uses to mean "ours". */
export function JudgePanel({ visit }: { visit: VisitClosed | null }) {
  if (!visit) {
    return (
      <EmptyState
        icon="judge"
        title="No grade on this Visit yet"
        body="The Judge is called once, when the Visit closes. It sees the question, the answer and the grounding — and nothing about how the conversation went."
      />
    );
  }

  return (
    <div className="stack g-6">
      <div className="judge">
        <div className="judge-head">
          <span>Blind grade</span>
          <span className="mono">{visit.topic_visit_id.slice(0, 12)}</span>
        </div>
        <div className="judge-body">
          <div className="judge-blind">
            <Icon name="blind" size={14} strokeWidth={1.5} />
            No transcript. No prior scores. No name.
          </div>
          <dl className="judge-in">
            <dt>Mode</dt><dd>{GRADING_MODE_LABEL[visit.grading_mode]}</dd>
            <dt>Weight</dt><dd>{GRADING_MODE_WEIGHT[visit.grading_mode]}</dd>
            <dt>Rubric</dt><dd>{visit.rubric_version}</dd>
            {visit.rationale ? <><dt>Reasoning</dt><dd>{visit.rationale}</dd></> : null}
          </dl>
          <div className="between hair-t" style={{ paddingTop: "var(--s-5)" }}>
            <span className="row g-4">
              <Tag tone="judge">{visit.grader}</Tag>
              <Tag tone="judge">{visit.provider}</Tag>
            </span>
            <span className="mono" style={{ color: "var(--fg)", fontSize: "var(--t-16)" }}>
              {visit.score.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      <p className="caption" style={{ margin: 0 }}>
        The grader never held this conversation. It sees question, answer and grounding — nothing about how
        fluent you sounded three turns ago.
      </p>
    </div>
  );
}
