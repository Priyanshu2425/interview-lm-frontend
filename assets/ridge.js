/* PosteriorRidge — draws a Beta density from (alpha, beta).

   ISSUE-0016 is explicit that this component DRAWS and does not DERIVE: the
   band and the mastery figure arrive already decided by the backend, because
   the surface holds no invariant (ADR-0009). If this file ever starts computing
   a band, two implementations of the Evidence Floor exist and they will drift.

   Where the band is `untested` it renders no number at all. There is no branch
   here that prints one. */

const STROKE = {
  untested: "#8195b0",
  early: "#7d5400",
  firm_weak: "#c00219",
  firm_strong: "#1c7a50",
};
const FILL = {
  untested: "rgba(129,149,176,.18)",
  early: "rgba(125,84,0,.12)",
  firm_weak: "rgba(192,2,25,.12)",
  firm_strong: "rgba(28,122,80,.14)",
};

/* Unnormalised Beta density in log space, scaled to its own maximum. Enough for
   a shape; the interval and the band come from the server, which uses scipy. */
function density(a, b, n = 120) {
  const xs = [], ls = [];
  for (let i = 0; i <= n; i++) {
    const x = Math.min(Math.max(i / n, 1e-6), 1 - 1e-6);
    xs.push(x);
    ls.push((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x));
  }
  const max = Math.max(...ls);
  return { xs, ys: ls.map((l) => Math.exp(l - max)) };
}

function path(a, b, W, H) {
  const PAD = 1;
  const { xs, ys } = density(a, b);
  const px = (x) => PAD + x * (W - PAD * 2);
  const py = (y) => H - 2 - y * (H - 10);
  const line = xs
    .map((x, i) => `${i ? "L" : "M"}${px(x).toFixed(2)},${py(ys[i]).toFixed(2)}`)
    .join("");
  return { line, area: `${line}L${px(1)},${H}L${px(0)},${H}Z`, px };
}

/**
 * @param {object} o
 * @param {number} o.alpha  from the API
 * @param {number} o.beta   from the API
 * @param {string} o.band   from the API — never computed here
 * @param {string} o.label  from the API
 * @param {{alpha:number,beta:number}} [o.from]  animate from this prior
 */
export function PosteriorRidge({ alpha, beta, band, label, from, height = 60,
                                width = 260 }) {
  if (band === undefined) {
    throw new Error("band must come from the API; the surface does not derive it");
  }
  const untested = band === "untested";
  const stroke = STROKE[band] || STROKE.untested;
  const fill = FILL[band] || FILL.untested;

  const wrap = document.createElement("div");
  wrap.className = "ridge";
  wrap.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${
      untested
        ? `${label || "Untested"} — no reading`
        : `${label}: posterior density centred near ${(alpha / (alpha + beta) * 100).toFixed(0)} percent`
    }">
      <line x1="1" y1="${height - 2}" x2="${width - 1}" y2="${height - 2}"
            stroke="#d7dee8" stroke-width="1"/>
      <path class="ridge__area" fill="${fill}"/>
      <path class="ridge__line" fill="none" stroke="${stroke}" stroke-width="1.75"
            stroke-linejoin="round" ${untested ? 'stroke-dasharray="3 3"' : ""}/>
      <line class="ridge__mean" y1="${height - 2}" y2="8" stroke="${stroke}"
            stroke-width="1.5" stroke-dasharray="2 2" ${untested ? 'opacity="0"' : ""}/>
    </svg>`;

  const area = wrap.querySelector(".ridge__area");
  const lineEl = wrap.querySelector(".ridge__line");
  const mean = wrap.querySelector(".ridge__mean");

  const paint = (a, b) => {
    const { line, area: ar, px } = path(a, b, width, height);
    area.setAttribute("d", ar);
    lineEl.setAttribute("d", line);
    const m = px(a / (a + b)).toFixed(2);
    mean.setAttribute("x1", m);
    mean.setAttribute("x2", m);
  };

  if (from && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    /* One of the system's two authored motions: the prior deforming into the
       posterior it became. The band is read from the FINAL posterior, so no
       mid-tween frame shows a reading the Topic does not have. */
    paint(from.alpha, from.beta);
    const run = () => {
      const t0 = performance.now(), DUR = 900;
      const ease = (t) => 1 - Math.pow(1 - t, 3);
      const step = (now) => {
        const t = Math.min(1, (now - t0) / DUR), k = ease(t);
        paint(from.alpha + (alpha - from.alpha) * k,
              from.beta + (beta - from.beta) * k);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); run(); }
      }, { threshold: 0.5 });
      io.observe(wrap);
    } else run();
  } else {
    paint(alpha, beta);
  }

  return wrap;
}

export function RidgeCaption(left, middle, right) {
  const d = document.createElement("div");
  d.className = "ridge__caption";
  d.innerHTML = `<span>${left}</span><span class="mono">${middle}</span><span>${right}</span>`;
  return d;
}
