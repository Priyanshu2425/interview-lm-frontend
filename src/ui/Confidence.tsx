import { useEffect, useState } from "react";
import type { Band } from "@/shared/types";
import { bandClass } from "@/shared/utils/band";
import { cn } from "@/shared/utils/cn";
import { useReducedMotion } from "@/shared/hooks";
import { betaGeometry, floorGeometry } from "./data/beta";

/* ---------------------------------------------------------------- Beta ---- */

interface BetaProps {
  alpha: number;
  beta: number;
  /* Never optional and never derived. A component that could render a curve
     without a band would be a second Evidence Floor. */
  band: Band;
  label: string;
  mastery: number | null;
  width?: number;
  height?: number;
  /* The prior this posterior updated. Supplying it plays the system's second
     authored motion: you watch one graded answer barely narrow the interval. */
  from?: { alpha: number; beta: number };
  className?: string;
}

export function BetaCurve({
  alpha, beta, band, label, mastery, width = 220, height = 72, from, className,
}: BetaProps) {
  const untested = band === "untested";
  const reduced = useReducedMotion();

  /* `tween` is null except while the update is playing. The resting shape is
     derived from the props during render, so there is no effect writing state
     that render could have computed. */
  const [tween, setTween] = useState<{ alpha: number; beta: number } | null>(null);
  const animate = Boolean(from) && !reduced;
  const shown = animate && tween ? tween : { alpha, beta };

  useEffect(() => {
    if (!from || reduced) return;
    let frame = 0;
    const start = performance.now();
    const DURATION = 700;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const k = ease(t);
      setTween({
        alpha: from.alpha + (alpha - from.alpha) * k,
        beta: from.beta + (beta - from.beta) * k,
      });
      if (t < 1) frame = requestAnimationFrame(step);
      else setTween(null);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [alpha, beta, from, reduced]);

  const description = untested
    ? `${label} — no reading. Not enough evidence on record to show a distribution.`
    : `${label}. Mastery ${mastery === null ? "unavailable" : mastery.toFixed(2)}, drawn as a Beta density.`;

  if (untested) {
    const { axis, ghost } = floorGeometry(width, height);
    return (
      <svg className={cn("beta", className)} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
        <path className="beta-floor" d={axis} />
        <path className="beta-floor" d={ghost} />
      </svg>
    );
  }

  const { line, area, meanX } = betaGeometry(shown.alpha, shown.beta, width, height);
  return (
    <svg className={cn("beta", className)} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
      <path className="beta-area" d={area} />
      <path className="beta-line" d={line} />
      <line className="beta-mean" x1={meanX.toFixed(1)} y1="2" x2={meanX.toFixed(1)} y2={height} />
      <line className="beta-axis" x1="0" y1={height} x2={width} y2={height} />
    </svg>
  );
}

/* ------------------------------------------------------------- readings ---- */

/* Below the floor this renders the word and NO number. There is deliberately
   no branch here that prints one. */
export function Reading({ band, label, mastery, size = "md" }: {
  band: Band;
  label: string;
  mastery: number | null;
  size?: "sm" | "md";
}) {
  if (band === "untested" || mastery === null) {
    return (
      <span className="untested">
        <i className="untested-mark" aria-hidden="true" />
        {label}
      </span>
    );
  }
  return (
    <span className="mastery">
      <span className={cn("mastery-num", size === "sm" && "mastery-num-sm")}>{mastery.toFixed(2)}</span>
      <span className="mastery-unit">mastery</span>
      {/* The band, in words, for anyone not reading the colour.

          Which band a figure falls in is drawn as a tint, and a tint is the one
          thing a greyscale screen and a screen reader both lose. 0.60 does not
          say whether this system calls it weak or solid — the band does, and it
          is decided by the server and handed here as `label`, so saying it adds
          no second implementation of the Evidence Floor (ADR-0009). */}
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

/* Coverage is an evidence count. It is drawn beside Mastery and never fused
   with it — there is no prop here that would produce one figure. */
export function Coverage({ value, max = 12 }: { value: number; max?: number }) {
  const filled = Math.min(Math.round(value), max);
  const ticks = Math.min(Math.max(Math.round(value), 3), max);
  return (
    <span className="coverage" data-cov={value.toFixed(1)} title={`${value.toFixed(1)} effective visits on record`}>
      {Array.from({ length: ticks }, (_, i) => (
        <i key={i} data-empty={i >= filled ? "" : undefined} />
      ))}
    </span>
  );
}

export function CoverageFloor({ have, need }: { have: number; need: number }) {
  return <span className="coverage-floor">{have} / {need} to floor</span>;
}

/* ---------------------------------------------------------- one Visit ----- */

export function Dial({ value, band, label }: { value: number; band: Band; label: string }) {
  const reduced = useReducedMotion();
  /* Starts empty and fills on the next frame — a Visit resolves once, and it
     is allowed to take a beat. With motion reduced it is simply already full,
     decided during render rather than by an effect. */
  const [filled, setFilled] = useState(false);
  const v = reduced || filled ? value : 0;

  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, [reduced, value]);

  return (
    <div
      className={cn("dial", bandClass(band))}
      style={{ "--v": v } as React.CSSProperties}
      data-label={value.toFixed(2)}
      role="img"
      aria-label={`${label}. Visit score ${value.toFixed(2)} out of 1.00.`}
    />
  );
}

/* ----------------------------------------------------------- the corpus --- */

export interface HeatCell {
  key: string;
  band: Band;
  title: string;
  label: string;
  mastery: number | null;
  /* A cell nobody has been examined on has no reading to open. It stays a
     mark rather than becoming a button that does nothing when pressed. */
  selectable?: boolean;
}

/* One cell per Topic, in curriculum order. Untested cells are holes, not dark
   cells — a hole reads as "not asked", a dark cell reads as "failed". */
export function Heat({ cells, onSelect }: { cells: HeatCell[]; onSelect?: (key: string) => void }) {
  return (
    <div className="heat" role="list" aria-label="Every Topic in the corpus, in curriculum order">
      {cells.map((cell) => {
        const untested = cell.band === "untested";
        const description = untested
          ? `${cell.title} — Untested`
          : `${cell.title} — ${cell.label}, mastery ${cell.mastery?.toFixed(2) ?? "—"}`;

        if (!onSelect || cell.selectable === false) {
          return (
            <i
              key={cell.key}
              role="listitem"
              aria-label={description}
              className={bandClass(cell.band)}
              data-untested={untested ? "" : undefined}
              title={description}
            />
          );
        }
        return (
          <button
            key={cell.key}
            role="listitem"
            type="button"
            title={description}
            aria-label={description}
            onClick={() => onSelect(cell.key)}
          >
            <i className={bandClass(cell.band)} data-untested={untested ? "" : undefined} />
          </button>
        );
      })}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span className="band-untested"><i data-untested="" />Untested</span>
      <span className="band-fragile"><i />Looks weak</span>
      <span className="band-partial"><i />Early signal</span>
      <span className="band-solid"><i />Looks solid</span>
    </div>
  );
}

/* One tick per Topic, dashed where untested. A Module never averages an
   untested Topic into its own number. */
export function Strip({ bands }: { bands: Band[] }) {
  return (
    <span className="strip" aria-hidden="true">
      {bands.map((band, i) => (
        <i key={i} className={bandClass(band)} data-untested={band === "untested" ? "" : undefined} />
      ))}
    </span>
  );
}
