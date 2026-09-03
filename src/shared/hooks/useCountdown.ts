import { useSyncExternalStore } from "react";

/* One second-hand for the whole app.

   Every countdown on screen reads the same tick, so ten timers register one
   interval rather than ten, and the interval only exists while something is
   watching it. Reading the clock through the store keeps render pure — no
   component calls Date.now() while React is rendering it. */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = 0;

function subscribe(cb: () => void): () => void {
  if (listeners.size === 0) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, 1000);
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const snapshot = () => now;
const serverSnapshot = () => 0;

/* Seconds remaining against a fixed end instant.

   It is allowed to go negative and the caller is expected to render that: the
   deadline is soft, and a Session ends *after* the question being asked
   finishes, never inside one. Clamping at zero would tell the Candidate the
   Session had already stopped. */
export function useCountdown(endsAt: number | null): number | null {
  const tick = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (endsAt === null) return null;
  /* Before the first tick lands, `tick` is whatever the last subscriber saw.
     Falling back to the end instant renders "0:00 left" for at most one frame
     rather than a wrong number. */
  return Math.round((endsAt - (tick || endsAt)) / 1000);
}
