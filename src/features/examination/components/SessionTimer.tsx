import { Icon } from "@/ui";
import { clock, duration as fmtDuration } from "@/shared/utils/format";
import { useCountdown } from "@/shared/hooks";

/* The deadline is soft: past due is a state to report, not a stop. A Session
   ends after the current Topic Visit finishes, never inside one. */
export function SessionTimer({ startedAt, durationSeconds }: {
  startedAt: number | null;
  durationSeconds: number;
}) {
  const endsAt = startedAt === null ? null : startedAt + durationSeconds * 1000;
  const remaining = useCountdown(endsAt);

  if (remaining === null) {
    return (
      <span className="timer" title="This Session was opened on another device or in an earlier visit">
        <Icon name="timer" size={13} />
        {fmtDuration(durationSeconds)} Session
      </span>
    );
  }

  const overdue = remaining <= 0;
  return (
    <span className={overdue ? "timer timer--soft" : "timer"} aria-live="off">
      <Icon name="timer" size={13} />
      {overdue ? "Past due — finishing this Visit" : `${clock(remaining)} left`}
    </span>
  );
}

export function VisitDots({ scored, total }: { scored: number; total: number }) {
  const dots = Math.max(total, scored + 1);
  return (
    <span
      className="visits"
      title={`${scored} Visit${scored === 1 ? "" : "s"} scored, on Visit ${scored + 1}`}
      role="img"
      aria-label={`${scored} of ${dots} Topic Visits scored`}
    >
      {Array.from({ length: dots }, (_, i) => (
        <i
          key={i}
          data-done={i < scored ? "" : undefined}
          data-current={i === scored ? "" : undefined}
        />
      ))}
    </span>
  );
}
