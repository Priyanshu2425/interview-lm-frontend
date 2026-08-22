import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

export type TagTone = "neutral" | "accent" | "ok" | "warn" | "risk" | "judge";

/* A fact, not a control. `judge` is achromatic by token: the grader's surface
   is denied the accent that everything else uses to mean "ours". */
export function Tag({ tone = "neutral", children, title }: {
  tone?: TagTone;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={cn("tag", tone !== "neutral" && `tag-${tone}`)} title={title}>
      {children}
    </span>
  );
}
