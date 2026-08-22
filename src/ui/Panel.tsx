import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/utils/cn";

interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode;
  className?: string;
  pad?: 4 | 5 | 6 | 7 | 8;
  tone?: "1" | "2";
}

export function Panel({ children, className, pad, tone = "1", ...rest }: PanelProps) {
  return (
    <div className={cn(tone === "1" ? "panel" : "panel-2", pad && `pad-${pad}`, className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionHead({ title, aside, step }: {
  title: string;
  aside?: ReactNode;
  step?: string;
}) {
  return (
    <div className="section-head">
      <div>
        {step ? <span className="eyebrow" style={{ color: "var(--accent)" }}>{step}</span> : null}
        <h2 className={cn("h2", step && "mt-3")}>{title}</h2>
      </div>
      {aside ? <span className="caption">{aside}</span> : null}
    </div>
  );
}

/* Two readings, side by side, and no combined output. The rule is the absent
   API: there is no prop here that returns one figure. */
export function Stat({ label, value, unit, note }: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="stat">
      <span className="stat-k">{label}</span>
      <span className="stat-v">{value}{unit ? <small>{unit}</small> : null}</span>
      {note ? <span className="stat-note">{note}</span> : null}
    </div>
  );
}
