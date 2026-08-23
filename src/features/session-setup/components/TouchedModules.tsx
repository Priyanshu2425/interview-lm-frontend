import type { TouchedModule } from "@/shared/types";
import { Icon, Panel, Tag } from "@/ui";

/* Where Related Topics meets a Candidate (ADR-0023).

   The picker, and the reason is the whole point: nothing has been measured
   when somebody is choosing scope, so a list of Modules has no score to sit
   beside and cannot be read as remediation. It says the material connects —
   which is true of the Corpus and says nothing about the person.

   Two rules this component keeps and cannot be allowed to lose:

   - It renders what the server ranked. No sorting, no threshold, no cut-off
     computed here (ADR-0009).
   - It carries no figure about the Candidate. There is no Coverage here, no
     Mastery, and nothing that could be combined into one — which is why the
     copy talks about Modules touching each other rather than about anything to
     do next. */

export function TouchedModules({ touched, onAdd }: {
  touched: TouchedModule[] | undefined;
  onAdd: (moduleId: string) => void;
}) {
  const sideways = (touched ?? []).filter((m) => !m.in_scope);
  const covered = (touched ?? []).filter((m) => m.in_scope);

  /* A Topic with no neighbours, a Library too small to have any, and a
     deployment holding none all render as nothing at all. No empty state and
     no explanatory copy: all three are honest, and all three look the same. */
  if (sideways.length === 0) return null;

  return (
    <Panel tone="2" pad={6} className="mt-6">
      <div className="row g-4">
        <Icon name="info" size={16} />
        <span className="eyebrow">Modules this scope touches</span>
      </div>
      <p className="caption mt-4">
        These Modules share material with what you have chosen — a reading of the
        Corpus, not of you. Nothing here is a suggestion about what to study.
        {covered.length > 0
          ? ` ${covered.length} more sit inside your scope already.`
          : ""}
      </p>
      <ul className="stack g-2 mt-5" style={{ listStyle: "none" }}>
        {sideways.map((m) => (
          <li key={m.module_id}>
            <button
              type="button"
              className="scope-item"
              style={{ width: "100%", textAlign: "left" }}
              onClick={() => onAdd(m.module_id)}
            >
              <span className="scope-mark" aria-hidden="true">
                <Icon name="plus" size={13} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="body-sm">{m.title}</span>
                <span className="caption" style={{ display: "block" }}>
                  {m.edges} connection{m.edges === 1 ? "" : "s"} to the material you chose
                </span>
              </span>
              <Tag>{m.track_key}</Tag>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
