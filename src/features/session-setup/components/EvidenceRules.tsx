import { Panel } from "@/ui";
import { EVIDENCE_RULES } from "@/shared/stores/preferences";

/* Shown, not set. The weights are properties of the Grading Mode and are
   decided on the server, so a slider here would be a control that changes
   nothing — and a Session's rules are fixed before it starts anyway. */
export function EvidenceRules() {
  return (
    <>
      <Panel>
        <ul style={{ listStyle: "none" }}>
          {EVIDENCE_RULES.map((rule, i) => (
            <li key={rule.weight} className={`rule-row${i > 0 ? " hair-t" : ""}`}>
              <span className="rule-weight">{rule.weight}</span>
              <span>
                <span className="body-sm" style={{ color: "var(--fg)" }}>{rule.title}</span>
                <span className="caption" style={{ display: "block", marginTop: "var(--s-2)" }}>
                  {rule.body}
                </span>
              </span>
            </li>
          ))}
          <li className="rule-row hair-t">
            <span className="rule-weight rule-weight--soft">↓</span>
            <span>
              <span className="body-sm" style={{ color: "var(--fg)" }}>A hint drops the weight further</span>
              <span className="caption" style={{ display: "block", marginTop: "var(--s-2)" }}>
                The examiner offers a hint when it judges one useful. It is recorded on the row rather than
                folded into the score.
              </span>
            </span>
          </li>
        </ul>
      </Panel>
      <p className="caption mt-4">
        A missing Answer Key lowers the weight of your evidence. It never makes material unusable, and the
        reason travels with the row rather than being folded into the number.
      </p>
    </>
  );
}
