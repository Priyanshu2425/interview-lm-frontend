import { useEffect, useRef } from "react";

/* The bars that move while somebody is speaking (ISSUE-0054).
 *
 * Imperative on purpose, and this is the one place in the feature that is.
 * The engine writes bar heights straight onto these nodes at animation frame
 * rate — sixty writes a second — and routing that through React state would
 * re-render the composer, the transcript and the plan rail sixty times a
 * second while a Candidate is mid-sentence.
 *
 * `attachMeter` takes the two nodes and owns them until it is handed null.
 * Nothing here reads what it wrote; a meter is for the person speaking.
 */

const BARS = 22;

interface LevelMeterProps {
  /** Called with the two nodes once they exist, and with nulls on unmount.
   *  This is `attachMeter` — passed in rather than imported so the component
   *  stays a thing that can be rendered in a test without an `AudioContext`. */
  attach: (bars: HTMLElement | null, halo: HTMLElement | null) => void;
  /** The halo around the microphone, which scales with the same signal. */
  haloRef: React.RefObject<HTMLElement | null>;
  live: boolean;
}

export function LevelMeter({ attach, haloRef, live }: LevelMeterProps) {
  const bars = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!live) return;
    attach(bars.current, haloRef.current);
    /* Handed back on the way out. A meter still holding a node from an
       unmounted composer is a write into a detached tree every frame, for as
       long as the tab is open. */
    return () => attach(null, null);
  }, [attach, haloRef, live]);

  return (
    <div className="levels" data-idle={live ? undefined : ""} aria-hidden="true" ref={bars}>
      {Array.from({ length: BARS }, (_, i) => <i key={i} />)}
    </div>
  );
}
