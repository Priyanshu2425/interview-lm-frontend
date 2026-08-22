import type { PaymentRoute } from "@/shared/types";
import { credits as fmtCredits } from "@/shared/utils/format";

/* Off the Credits route this renders an em dash, never `0`: zero reads as
   "it was free" rather than "this ledger does not apply to you". */
export function CostValue({ value, route, unit }: {
  value: number | null;
  route: PaymentRoute;
  unit?: string;
}) {
  return (
    <span
      className="cost"
      title={route === "credits"
        ? "One Credit is one US cent of provider cost"
        : "You are on your own key, so no Credits are spent"}
    >
      <span className="cost-val">{fmtCredits(value, route)}</span>
      {unit ? <span className="cost-unit">{unit}</span> : null}
    </span>
  );
}

/* An estimate is never styled as a figure. */
export function CostUnknown({ children }: { children: string }) {
  return <span className="cost-unknown">{children}</span>;
}
