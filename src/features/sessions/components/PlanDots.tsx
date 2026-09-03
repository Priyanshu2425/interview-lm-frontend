/* How far into its plan a Session got.
   A position, not a performance: a Session that asked two of five has not
   failed the other three — they were never put. */
export function PlanDots({ asked, budget }: { asked: number; budget: number }) {
  return (
    <span
      className="dots"
      role="img"
      aria-label={`${asked} of ${budget} questions asked`}
    >
      {Array.from({ length: budget }, (_, i) => (
        <i key={i} data-done={i < asked ? "" : undefined} />
      ))}
    </span>
  );
}
