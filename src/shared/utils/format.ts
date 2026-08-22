import type { GradingMode, PaymentRoute } from "@/shared/types";

const EM_DASH = "—";

/* A Credit is one US cent of provider cost. Off the Credits route this renders
   an em dash and never `0` — zero reads as "it was free" rather than "this
   ledger does not apply to you". */
export function credits(value: number | null | undefined, route: PaymentRoute): string {
  if (route !== "credits" || value === null || value === undefined) return EM_DASH;
  return `${value.toLocaleString("en-US")} Cr`;
}

export function usd(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return EM_DASH;
  return `$${(cents / 100).toFixed(2)}`;
}

export function score(value: number | null | undefined): string {
  return value === null || value === undefined ? EM_DASH : value.toFixed(2);
}

export function duration(seconds: number): string {
  if (seconds <= 0) return "Until you stop";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function clock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diff);
  const fmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return fmt.format(Math.round(diff), "second");
  if (abs < 3600) return fmt.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return fmt.format(Math.round(diff / 3600), "hour");
  return fmt.format(Math.round(diff / 86400), "day");
}

/* Named in the Candidate's terms, not the schema's. */
export const GRADING_MODE_LABEL: Record<GradingMode, string> = {
  ground_truth: "Graded against an Answer Key",
  text_grounded: "Graded from the course text",
  model_judgment: "Graded on the interviewer's own knowledge",
};

export const GRADING_MODE_SHORT: Record<GradingMode, string> = {
  ground_truth: "Answer Key",
  text_grounded: "Course text",
  model_judgment: "Model judgment",
};

export const GRADING_MODE_WEIGHT: Record<GradingMode, string> = {
  ground_truth: "1.00",
  text_grounded: "0.70",
  model_judgment: "0.50",
};

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
