import type { Band } from "@/shared/types";

/* A band arrives already decided by the server. This maps it to the design
   system's ramp class and does nothing else — there is no branch here that
   inspects a mastery figure, because a second implementation of the Evidence
   Floor would drift from the first.

   The design system also ships `band-working`. No API band produces it: the
   server reports four bands, read off the credible interval, and inventing a
   fifth here to fill the palette would be exactly the kind of derived number
   this product refuses. */
const RAMP: Record<Band, string> = {
  untested: "band-untested",
  early: "band-partial",
  firm_weak: "band-fragile",
  firm_strong: "band-solid",
};

export function bandClass(band: Band): string {
  return RAMP[band] ?? "band-untested";
}

export function isReportable(band: Band): boolean {
  return band !== "untested";
}

/* Word first, colour second — PRODUCT.md names the bands as the one place
   that rule is unconditional. */
export const BAND_LABEL: Record<Band, string> = {
  untested: "Untested",
  early: "Early signal",
  firm_weak: "Looks weak",
  firm_strong: "Looks solid",
};
