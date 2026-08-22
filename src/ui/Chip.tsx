import type { ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

interface ChipProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  className?: string;
}

/* State is carried by aria-pressed as well as by fill, so it survives a
   greyscale screenshot and a screen reader alike. */
export function Chip({ pressed, onClick, children, count, className }: ChipProps) {
  return (
    <button type="button" className={cn("chip", className)} aria-pressed={pressed} onClick={onClick}>
      {children}
      {count === undefined ? null : <span className="chip-count">{count}</span>}
    </button>
  );
}
