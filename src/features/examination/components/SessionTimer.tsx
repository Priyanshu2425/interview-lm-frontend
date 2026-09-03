import { Icon } from "@/ui";
import { clock, duration as fmtDuration } from "@/shared/utils/format";
import { useCountdown } from "@/shared/hooks";

/* The deadline is soft: past due is a state to report, not a stop. A Session
   ends after the question being asked finishes, never inside one. */
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
