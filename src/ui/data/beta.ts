/* The Beta density, as a path.

   This DRAWS and does not DERIVE. The band, the Mastery figure and the
   credible interval arrive already decided by the server, which computes them
   with scipy. If this module ever starts choosing a band, two implementations
   of the Evidence Floor exist and they will drift.

   Shape encodes Coverage — more evidence, a narrower ridge. Position encodes
   Mastery. */

const SAMPLES = 96;

/* Unnormalised, in log space, scaled to its own maximum. Enough for a shape;
   the interval comes from the API. */
function density(alpha: number, beta: number): number[] {
  const logs = new Array<number>(SAMPLES + 1);
  let max = -Infinity;
  for (let i = 0; i <= SAMPLES; i++) {
    const x = Math.min(Math.max(i / SAMPLES, 1e-6), 1 - 1e-6);
    const l = (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x);
    logs[i] = l;
    if (l > max) max = l;
  }
  const out = new Array<number>(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) out[i] = Math.exp(logs[i] - max);
  return out;
}

export interface BetaGeometry {
  line: string;
  area: string;
  meanX: number;
}

export function betaGeometry(alpha: number, beta: number, w: number, h: number): BetaGeometry {
  const ys = density(alpha, beta);
  const top = 2;
  let line = "";
  for (let i = 0; i <= SAMPLES; i++) {
    const x = ((i / SAMPLES) * w).toFixed(1);
    const y = (h - ys[i] * (h - top - 1) - 1).toFixed(1);
    line += `${i ? "L" : "M"}${x} ${y}`;
  }
  return {
    line,
    area: `${line}L${w} ${h}L0 ${h}Z`,
    meanX: (alpha / (alpha + beta)) * w,
  };
}

/* Below the floor: a hairline in the dash pattern, and a flattened arc where
   the ridge would have been. No fill, no mean line, no numeral. */
export function floorGeometry(w: number, h: number): { axis: string; ghost: string } {
  return {
    axis: `M0 ${h - 1}H${w}`,
    ghost:
      `M${(w * 0.06).toFixed(1)} ${(h - 7).toFixed(1)}` +
      `C${(w * 0.3).toFixed(1)} ${(h - 9).toFixed(1)} ` +
      `${(w * 0.7).toFixed(1)} ${(h - 9).toFixed(1)} ` +
      `${(w * 0.94).toFixed(1)} ${(h - 7).toFixed(1)}`,
  };
}
