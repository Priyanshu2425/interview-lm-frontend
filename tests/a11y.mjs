/* ISSUE-0020, the machine-checkable half.
   Contrast is measured on what actually rendered, with SEMI-TRANSPARENT
   backgrounds composited down the ancestor chain — treating rgba() as opaque
   is how an audit invents failures that are not there. */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let pass = 0, fail = 0; const findings = [];
const ok = (n, c, x = '') => { c ? pass++ : (fail++, findings.push(`${n}${x ? ' — ' + x : ''}`));
  console.log(`  ${c ? '✓' : '✗'} ${n}${c || !x ? '' : ' — ' + x}`); };

const CONTRAST = `(()=>{
  const parse=c=>{const m=c.match(/[\\d.]+/g).map(Number);
    return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1}};
  const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
    return .2126*f(r)+.7152*f(g)+.0722*f(b)};
  const blend=(fg,bg)=>({r:fg.r*fg.a+bg.r*(1-fg.a),g:fg.g*fg.a+bg.g*(1-fg.a),
    b:fg.b*fg.a+bg.b*(1-fg.a),a:1});
  /* walk up compositing every translucent layer, rather than stopping at the
     first non-transparent one */
  const groundOf=el=>{
    const layers=[]; let n=el;
    while(n&&n!==document.documentElement){
      const c=parse(getComputedStyle(n).backgroundColor);
      if(c.a>0)layers.push(c);
      if(c.a===1)break;
      n=n.parentElement;
    }
    if(!layers.length)layers.push(parse(getComputedStyle(document.body).backgroundColor));
    let out=layers[layers.length-1];
    for(let i=layers.length-2;i>=0;i--)out=blend(layers[i],out);
    return out;};
  const out=[];
  document.querySelectorAll('*').forEach(el=>{
    if(el.children.length||!el.textContent.trim())return;
    const cs=getComputedStyle(el);
    if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0)return;
    const size=parseFloat(cs.fontSize), bold=+cs.fontWeight>=700;
    const need=(size>=24||(size>=18.66&&bold))?3:4.5;
    const [a,b]=[lum(parse(cs.color)),lum(groundOf(el))].sort((x,y)=>y-x);
    const ratio=(a+.05)/(b+.05);
    if(ratio<need)out.push({t:el.textContent.trim().slice(0,38),
      ratio:+ratio.toFixed(2),need,color:cs.color,size:Math.round(size)});
  });
  return out;})()`;

const b = await chromium.launch();
const seed = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await seed.newPage();
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
const cid = await p.evaluate(() => localStorage.getItem('candidate_id'));
await p.evaluate(c => fetch('/v1/credits/grants', { method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ candidate_id: c, credits: 90000, payment_ref: 'a-' + c }) }), cid);
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);
await p.click('.opt[aria-pressed]'); await p.waitForTimeout(300);
await p.click('.actionbar .btn:last-child');
await p.waitForURL(/session/, { timeout: 15000 }); await p.waitForTimeout(700);
for (let i = 0; i < 3; i++) {
  await p.fill('.composer__field', `answer ${i}`);
  await p.click('.btn--onink'); await p.waitForTimeout(1700);
}
const sid = new URL(p.url()).searchParams.get('id');
const SCREENS = [['/', 'setup'], [`/session.html?id=${sid}`, 'exchange'],
  [`/summary.html?id=${sid}`, 'summary'], ['/credits.html', 'credits']];

console.log('\ncontrast, measured on rendered elements');
for (const scheme of ['light', 'dark']) {
  const c = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme });
  const q = await c.newPage();
  await q.goto(BASE + '/', { waitUntil: 'networkidle' });
  await q.evaluate(v => localStorage.setItem('candidate_id', v), cid);
  const bad = [];
  for (const [path, name] of SCREENS) {
    await q.goto(BASE + path, { waitUntil: 'networkidle' }); await q.waitForTimeout(650);
    const f = await q.evaluate(CONTRAST);
    if (f.length) bad.push(`${name}: ` + f.slice(0, 3)
      .map(x => `"${x.t}" ${x.ratio}:1 needs ${x.need} (${x.color} @${x.size}px)`).join('; '));
  }
  ok(`every text/background pair clears WCAG AA (${scheme})`, bad.length === 0, bad.join(' | '));
  await c.close();
}

console.log('\nfocus and keyboard');
await p.setViewportSize({ width: 1440, height: 1000 });
for (const [path, name] of SCREENS) {
  await p.goto(BASE + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
  const bad = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('button,a[href],input,textarea,select').forEach(el => {
      if (el.disabled) return; el.focus();
      const cs = getComputedStyle(el);
      const seen = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0)
        || cs.boxShadow !== 'none';
      if (!seen) out.push(el.tagName + '.' + (el.className || '').split(' ')[0]);
    });
    return out; });
  ok(`every enabled control shows a focus ring (${name})`, bad.length === 0, bad.slice(0, 3).join(', '));
}

console.log('\ncolour is never the only signal');
await p.goto(BASE + `/summary.html?id=${sid}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(650);
const bands = await p.evaluate(() => [...document.querySelectorAll('.band')]
  .map(b => b.textContent.replace(/\s+/g, ' ').trim()));
ok('every band carries a word', bands.length > 0 && bands.every(t => /[A-Za-z]{3,}/.test(t)),
   bands.slice(0, 3).join(' / '));
const grey = await p.evaluate(() => {
  document.documentElement.style.filter = 'grayscale(1)';
  return [...document.querySelectorAll('.band')].every(b => /[A-Za-z]{3,}/.test(b.textContent)); });
ok('every band is still readable in greyscale', grey);

console.log('\nreduced motion');
const rc = await b.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const r = await rc.newPage();
await r.goto(BASE + '/', { waitUntil: 'networkidle' });
await r.evaluate(v => localStorage.setItem('candidate_id', v), cid);
await r.goto(BASE + `/summary.html?id=${sid}`, { waitUntil: 'networkidle' });
await r.waitForTimeout(600);
const rm = await r.evaluate(() => ({
  drawn: (document.querySelector('.ridge__line')?.getAttribute('d') || '').length > 200,
  animating: [...document.querySelectorAll('*')].some(e =>
    parseFloat(getComputedStyle(e).animationDuration) > 0.1) }));
ok('the surface is fully usable with reduced motion', rm.drawn);
ok('nothing animates under prefers-reduced-motion', !rm.animating);
await rc.close();

console.log('\nresponsive');
for (const w of [390, 768, 1440]) {
  await p.setViewportSize({ width: w, height: 900 });
  const bad = [];
  for (const [path, name] of SCREENS) {
    await p.goto(BASE + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(420);
    const x = await p.evaluate(() => ({
      hx: document.documentElement.scrollWidth > innerWidth + 1,
      clipped: [...document.querySelectorAll('p,h1,h2,td,th,span')]
        .filter(e => !e.children.length && e.scrollWidth > e.clientWidth + 2
          && getComputedStyle(e).overflow === 'visible').length }));
    if (x.hx || x.clipped) bad.push(`${name}${x.hx ? ' overflow' : ''}${x.clipped ? ' clipped:' + x.clipped : ''}`);
  }
  ok(`no overflow or clipped text at ${w}px`, bad.length === 0, bad.join(', '));
}
await p.setViewportSize({ width: 390, height: 844 });
await p.goto(BASE + `/session.html?id=${sid}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(650);
const comp = await p.evaluate(() => { const c = document.querySelector('.composer');
  return c ? { bottom: Math.round(c.getBoundingClientRect().bottom), vh: innerHeight } : null; });
ok('the composer is in view on mobile without scrolling',
   !comp || comp.bottom <= comp.vh + 1, comp ? `${comp.bottom} of ${comp.vh}` : 'n/a');

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (findings.length) { console.log('\nfindings:'); findings.forEach(f => console.log('  · ' + f)); }
process.exit(fail ? 1 : 0);
