import { Fragment, useState } from "react";
import type { PaymentRoute } from "@/shared/types";
import { Coverage, EmptyState, Icon, Reading, SourceSpan, Tag } from "@/ui";
import { bandClass } from "@/shared/utils/band";
import {
  GRADING_MODE_SHORT, GRADING_MODE_WEIGHT, credits as fmtCredits, score as fmtScore,
} from "@/shared/utils/format";
import type { ReportRow } from "../hooks/useReport";
import { useTopicStanding } from "../hooks/useReport";

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

/* One row per Topic reached, because the Topic within a Session is the unit
   of evidence (ISSUE-0044): one observation per Topic per Session, however
   many questions touched it and however many Topics one question spanned.

   Only Topics that were reached are here. A Topic the Session never got to is
   rendered elsewhere, as a name — a different shape entirely, so there is no
   cell on this table that an absent measurement could fall into as a zero. */
export function TopicTable({ rows, route }: { rows: ReportRow[]; route: PaymentRoute }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="evidence"
        title="No Topic was reached in this Session"
        body="The Session is graded once, at the end, from what was actually said. Nothing was said about any Topic, so there is nothing to measure — and nothing was scored zero on the way past."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="table table--evidence">
        <caption className="visually-hidden">
          One row per Topic this Session reached, with how it was graded, what grounded it,
          and what it cost.
        </caption>
        <thead>
          <tr>
            <th className="col-toggle"><span className="visually-hidden">Grounding</span></th>
            <th>Topic</th>
            <th style={{ width: 150 }}>Graded</th>
            <th style={{ width: 68 }} className="n">Weight</th>
            <th style={{ width: 78 }} className="n">Questions</th>
            <th style={{ width: 158 }}>Reading</th>
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
                      {row.module_title || "—"}
                    </span>
                  </td>
                  <td>
                    {row.graded_by ? (
                      <Tag tone={row.graded_by === "ground_truth" ? "ok" : "neutral"}>
                        {GRADING_MODE_SHORT[row.graded_by]}
                      </Tag>
                    ) : <span className="caption">—</span>}
                  </td>
                  <td className="n">{row.graded_by ? GRADING_MODE_WEIGHT[row.graded_by] : "—"}</td>
                  <td className="n">{row.question_count}</td>
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
                              {row.graded_by === "model_judgment"
                                ? "Anchored to a syllabus and grounded in no span. There is nothing to quote, and quoting something anyway would make the record less honest, not more."
                                : "No span travelled with this row."}
                            </p>
                          ) : (
                            row.citations.map((c) => <SourceSpan citation={c} key={c.chunk_id} />)
                          )}
                        </div>

                        <div className="stack g-5">
                          <span className="eyebrow">What the Judge read</span>
                          {/* Two dimensions, apart, always. How much of the
                              material the answer explained is one question and
                              how close to correct it was is another, and the
                              average of two different questions answers
                              neither. The number they were combined into fed
                              the posterior and is not a reading — the API does
                              not carry it out here, and nothing on this screen
                              may put them back together. */}
                          <div className="stack g-5">
                            <div className="between">
                              <span className="body-sm dim">Explained the material</span>
                              <strong className="mono">{fmtScore(row.source_score)}</strong>
                            </div>
                            <div className="between">
                              <span className="body-sm dim">Close to correct</span>
                              <strong className="mono">{fmtScore(row.truth_score)}</strong>
                            </div>
                          </div>
                          <p className="caption" style={{ margin: 0 }}>
                            {row.source_score === null
                              ? "Graded on the interviewer's own knowledge, so there was no supplied material to have explained — and a zero there would read as having explained none of it."
                              : "Two readings, reported apart. They are not averaged into a score here or anywhere else."}
                          </p>

                          <span className="eyebrow">Where the Topic stands now</span>
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
                              ? "Still below the Evidence Floor. Untested is a fact about the evidence, not a score."
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
