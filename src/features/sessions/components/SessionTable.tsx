import { ButtonLink, Tag } from "@/ui";
import { duration as fmtDuration, relativeTime } from "@/shared/utils/format";
import type { SessionListing } from "@/shared/types";
import { endedAs } from "../reasons";

/* The record, in columns.
 *
 * A list of twenty is scanned down rather than read across, so every fact is
 * its own column. None of them is a reading: `Topics measured` is a count of
 * Evidence rows, and `Questions` is a position in a plan. There is no column
 * here that could hold a score, because a Session has none. */
export function SessionTable({ sessions, scopeOf }: {
  sessions: SessionListing[];
  scopeOf: (s: SessionListing) => string;
}) {
  return (
    <div className="table-scroll">
      <table className="table table--sessions">
        <caption className="visually-hidden">
          Sessions you have sat, newest first, with when each ran, how far into its
          plan it got, and how many Topics it measured.
        </caption>
        <thead>
          <tr>
            <th>Scope</th>
            <th style={{ width: 140 }}>When</th>
            <th style={{ width: 110 }} className="n">Ran for</th>
            <th style={{ width: 120 }} className="n">Questions</th>
            <th style={{ width: 150 }} className="n">Topics measured</th>
            <th style={{ width: 200 }}>How it ended</th>
            <th style={{ width: 110 }}><span className="visually-hidden">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const ended = s.state === "ended";
            return (
              <tr key={s.session_id}>
                <td style={{ color: "var(--fg)" }}>{scopeOf(s)}</td>
                <td className="caption">
                  {s.started_at ? relativeTime(s.started_at) : "—"}
                </td>
                <td className="n">{fmtDuration(s.duration_seconds)}</td>
                <td className="n">
                  {s.budget_questions
                    ? `${s.questions_asked} / ${s.budget_questions}`
                    : s.questions_asked || "—"}
                </td>
                {/* Only an ended Session has been graded. A dash on a parked
                    one would read as a measurement of nothing rather than as
                    a measurement not yet taken. */}
                <td className="n">{ended ? s.topics_measured : "—"}</td>
                <td className="caption">
                  {ended ? (
                    endedAs(s.ended_reason)
                  ) : s.state === "parked" ? (
                    <Tag tone="warn">Parked · not graded</Tag>
                  ) : (
                    <Tag tone="accent">Running</Tag>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  {ended ? (
                    <ButtonLink to={`/report/${s.session_id}`} variant="secondary" size="sm">
                      Report
                    </ButtonLink>
                  ) : (
                    <ButtonLink to={`/examination/${s.session_id}`} variant="secondary" size="sm">
                      Resume
                    </ButtonLink>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
