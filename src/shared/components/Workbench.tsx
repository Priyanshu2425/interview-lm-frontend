import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

/* The working surface every screen in the design set shares: a stage, and an
   optional panel that outranks nothing but is always in reach. Below 1080px
   the panel stops being a rail and stacks under the stage, which is what the
   mobile designs do.

   Extracted once rather than restated per screen — the design ships the same
   two-column rule five times, and five copies is how they drift. */
export function Workbench({ children, side, narrow, stage }: {
  children: ReactNode;
  side?: ReactNode;
  narrow?: boolean;
  /* Centre the content at reading measure — the examination transcript wants
     this; a table does not. */
  stage?: boolean;
}) {
  return (
    <div className={cn("workbench", !side && "workbench--solo")}>
      <section className={cn("workbench-main", narrow && "workbench-main--narrow")}>
        {stage ? <div className="workbench-stage">{children}</div> : children}
      </section>
      {side ? <aside className="workbench-side">{side}</aside> : null}
    </div>
  );
}
