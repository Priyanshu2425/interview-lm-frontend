import { Fragment, useState } from "react";
import type { PaymentRoute } from "@/shared/types";
import { Coverage, EmptyState, Icon, Reading, Tag } from "@/ui";
import { bandClass } from "@/shared/utils/band";
import { GRADING_MODE_SHORT, GRADING_MODE_WEIGHT, credits as fmtCredits } from "@/shared/utils/format";
import type { EvidenceRow } from "../hooks/useSessionRecord";
import { useTopicStanding } from "../hooks/useSessionRecord";

/* Where the Candidate stands on this one Topic (ADR-0022).

   Inside the drawer, for one Topic, opened deliberately. Not a column: a column
   of ranks can be read down the page, and a list of Topics ordered by where you
   stand on them is Topic recommendation, which does not exist here.

   Every unavailable case renders the API's own sentence rather than a composed
   one — below the Evidence Floor, below the Cohort Floor, or a Library nobody
   else holds are three different facts and the surface must not flatten them. */
function Standing({ topicId }: { topicId: string }) {
  const { data } = useTopicStanding(topicId);
  if (!data) return null;
  return (
    <div className="hair-t" style={{ paddingTop: "var(--s-5)" }}>
      <span className="eyebrow">Where you stand on this Topic</span>
      {data.rank === null ? (
        <p className="caption mt-4" style={{ margin: 0 }}>{data.reason}</p>
      ) : (
        <p className="body-sm mt-4" style={{ margin: 0 }}>
          <strong className="mono">
            #{data.rank}{data.shared ? "=" : ""}
          </strong>{" "}
          of {data.cohort} Candidates examined on this Topic.
          {data.shared
            ? " Shared, because the posteriors overlap — the measurement cannot separate you."
            : ""}
        </p>
      )}
    </div>
  );
}

/* One row per Topic Visit, because the Topic Visit is the unit of evidence:
   one Visit yields exactly one score and exactly one write, however many
   Answer Turns it contained. */
export function EvidenceTable({ rows, route }: { rows: EvidenceRow[]; route: PaymentRoute }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="evidence"
        title="No Topic was graded in this Session"
        body="A Visit writes its Evidence row when it closes. One that was interrupted stays open until it is graded, so nothing here is missing — it has not happened yet."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="table table--evidence">
        <caption className="visually-hidden">
          Evidence rows for this Session. One row per Topic Visit, with how it was graded, what grounded it,
          and what it cost.
        </caption>
        <thead>
          <tr>
            <th className="col-toggle"><span className="visually-hidden">Grounding</span></th>
            <th>Topic</th>
            <th style={{ width: 150 }}>Graded</th>
            <th style={{ width: 68 }} className="n">Weight</th>
            <th style={{ width: 62 }} className="n">Turns</th>
            <th style={{ width: 158 }}>Reading after</th>
            <th style={{ width: 88 }} className="n">Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const open = openId === row.topic_id;
            return (
              <Fragment key={row.topic_id}>
                <tr
                  data-clickable=""
                  data-open={open ? "" : undefined}
                  onClick={() => setOpenId(open ? null : row.topic_id)}
                >
                  <td className="col-toggle">
                    <button
                      type="button"
                      className="row-toggle"
                      aria-expanded={open}
                      aria-label={`${open ? "Hide" : "Show"} the grounding behind ${row.title}`}
                      onClick={(e) => { e.stopPropagation(); setOpenId(open ? null : row.topic_id); }}
                    >
                      <Icon name="chevron" size={13} />
                    </button>
                  </td>
                  <td>
                    {/* The Module is a property of the Topic, not a peer column.
                        Folding it in buys the width the Cost column needs. */}
                    <span style={{ color: "var(--fg)" }}>{row.title}</span>
                    <span className="caption" style={{ display: "block", marginTop: 2 }}>
                      {row.moduleTitle || "—"}
                    </span>
                  </td>
                  <td>
                    {row.gradedBy ? (
                      <Tag tone={row.gradedBy === "ground_truth" ? "ok" : "neutral"}>
                        {GRADING_MODE_SHORT[row.gradedBy]}
                      </Tag>
                    ) : <span className="caption">—</span>}
                  </td>
                  <td className="n">{row.gradedBy ? GRADING_MODE_WEIGHT[row.gradedBy] : "—"}</td>
                  <td className="n">{row.turnCount ?? "—"}</td>
                  <td>
                    <span className={`score-cell ${bandClass(row.band)}`}>
                      <Reading band={row.band} label={row.label} mastery={row.mastery} size="sm" />
                    </span>
                  </td>
                  <td className="n">{fmtCredits(row.credits, route)}</td>
                </tr>

                {open ? (
                  <tr className="drawer">
                    <td colSpan={7}>
                      <div className="drawer-inner">
                        <div className="stack g-5">
                          <span className="eyebrow">What grounded the questions</span>
                          {row.citations.length === 0 ? (
                            <p className="body-sm dim" style={{ margin: 0 }}>
                              {row.gradedBy === "model_judgment"
                                ? "Anchored to a syllabus and grounded in no span. There is nothing to quote, and quoting something anyway would make the record less honest, not more."
                                : "No span travelled with this row."}
                            </p>
                          ) : (
                            row.citations.map((c) => (
                              <div className="source" key={c.chunk_id}>
                                <div className="eyebrow">{c.title || c.source_id}</div>
                                <p className="source-span">{c.text}</p>
                                <div className="source-ref">
                                  {c.page === null ? null : <span>p. {c.page}</span>}
                                  <span>chunk {c.chunk_id}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="stack g-5">
                          <span className="eyebrow">The reading this Visit produced</span>
                          <div className={`stack g-5 ${bandClass(row.band)}`}>
                            <div className="between">
                              <span className="body-sm dim">Coverage</span>
                              <Coverage value={row.coverage} />
                            </div>
                            <div className="between">
                              <span className="body-sm dim">Mastery</span>
                              <strong className="mono">
                                {row.mastery === null ? "—" : row.mastery.toFixed(2)}
                              </strong>
                            </div>
                            <div className="between">
                              <span className="body-sm dim">Credible interval</span>
                              <strong className="mono">
                                {row.interval === null
                                  ? "—"
                                  : `${row.interval[0].toFixed(2)} – ${row.interval[1].toFixed(2)}`}
                              </strong>
                            </div>
                          </div>
                          <p className="caption" style={{ margin: 0 }}>
                            {row.mastery === null
                              ? "Still below the Evidence Floor after this Visit. Untested is a fact about the evidence, not a score."
                              : "Coverage and Mastery are two readings taken from one distribution. They are never fused."}
                          </p>
                          <Standing topicId={row.topic_id} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
