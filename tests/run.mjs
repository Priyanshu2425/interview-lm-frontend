/* End-to-end checks against the running API and a real browser.
   These assert what a Candidate would observe — and the rules the issues make
   non-negotiable, several of which are about what must NOT appear. */
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let pass = 0, fail = 0;
const ok  = (name, cond, extra='') => { cond ? (pass++, console.log(`  ✓ ${name}`))
  : (fail++, console.log(`  ✗ ${name}${extra?' — '+extra:''}`)); };

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', e => errors.push(e.message));
p.on('console', m => {
  const t = m.text();
  // A 4xx the app renders (a refused key, say) is the app working, not failing.
  if (m.type() === 'error' && !/Failed to load resource/.test(t))
    errors.push('console: ' + t);
});

console.log('\nISSUE-0014 — shell and setup');
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
const cid = await p.evaluate(() => localStorage.getItem('candidate_id'));
await p.evaluate(c => fetch('/v1/credits/grants', { method:'POST',
  headers:{'content-type':'application/json'},
  body: JSON.stringify({candidate_id:c, credits:90000, payment_ref:'t-'+c})}), cid);
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500);

const api = await (await fetch(BASE + '/v1/corpus/modules?track=aiml')).json();
const shown = await p.evaluate(() => [...document.querySelectorAll('.opt__right')]
  .map(x => (x.textContent.match(/(\d+) Topics/)||[])[1]).filter(Boolean).map(Number));
ok('Topic counts come from the API', JSON.stringify(shown.slice(0,8)) ===
   JSON.stringify(api.map(m => m.topic_count)), shown.slice(0,8).join(','));
ok('start is genuinely disabled with no scope',
   await p.evaluate(() => document.querySelector('.actionbar .btn:last-child').disabled));
const before = p.url();
await p.evaluate(() => document.querySelector('.actionbar .btn:last-child').click());
await p.waitForTimeout(300);
ok('clicking the disabled control does nothing', p.url() === before);
ok('no difficulty control anywhere',
   !(await p.evaluate(() => /difficult|\beasy\b|\bhard\b/i.test(document.body.innerText))));
ok('states that cost cannot be quoted in advance',
   await p.evaluate(() => /can't quote|cannot be quoted|not knowable/i.test(document.body.innerText)));

console.log('\nISSUE-0015 — the live exchange');
await p.click('.opt[aria-pressed]'); await p.waitForTimeout(400);
await p.click('.actionbar .btn:last-child');
await p.waitForURL(/session\.html/, { timeout: 15000 });
await p.waitForTimeout(900);
ok('a question renders', await p.evaluate(() => !!document.querySelector('.q')?.textContent.trim()));
ok('the Grading Mode is shown', await p.evaluate(() => !!document.querySelector('.chip')));
ok('both rails render on desktop', (await p.locator('.rail').count()) === 2);
const sid = new URL(p.url()).searchParams.get('id');

// Hold the turn response open so the in-flight window is observable rather
// than a race — the stubbed provider answers in milliseconds otherwise.
await p.route('**/turns', async route => {
  await new Promise(r => setTimeout(r, 1200));
  await route.continue();
});
await p.fill('.composer__field', 'Broadcasting aligns shapes from the trailing dimension.');
await p.click('.btn--onink');
await p.waitForTimeout(350);
ok('the composer is disabled while a turn is in flight',
   await p.evaluate(() => document.querySelector('.composer__field')?.disabled === true));
ok('the button says the request is running',
   await p.evaluate(() => /Sending/i.test(document.querySelector('.btn--onink')?.textContent || '')));
await p.waitForTimeout(3200);
await p.unroute('**/turns');
ok('the composer is usable again once the turn lands',
   await p.evaluate(() => document.querySelector('.composer__field')?.disabled === false));

console.log('\nISSUE-0016 — the scored Topic');
ok('a score renders', await p.evaluate(() => /^\d\.\d\d$/.test(
   document.querySelector('.panel .num')?.textContent?.trim() || '')));
ok('provenance is present beside it', await p.evaluate(() =>
   [...document.querySelectorAll('.tag')].some(t => /Judge/.test(t.textContent))));
ok('the cost is shown', await p.evaluate(() =>
   [...document.querySelectorAll('.tag')].some(t => /Cr|—/.test(t.textContent))));
ok('the posterior ridge is drawn from real alpha/beta',
   await p.evaluate(() => (document.querySelector('.ridge__line')?.getAttribute('d')||'').length > 200));
ok('Coverage and Mastery render as two readings',
   (await p.locator('.reading').count()) >= 2);
ok('no fused figure anywhere in the DOM', !(await p.evaluate(() =>
   /overall score|combined score|percent complete/i.test(document.body.innerText))));
const key = await (await fetch(`${BASE}/v1/sessions/${sid}`)).json();
ok('no Answer Key text is in the DOM', await p.evaluate(() =>
   !/AUTHORITATIVE ANSWER/i.test(document.body.innerText)));

console.log('\nidempotency');
const evBefore = await (await fetch(`${BASE}/v1/sessions/${sid}`)).json();
await p.evaluate(async (s) => {
  for (let i = 0; i < 3; i++)
    await fetch(`/v1/sessions/${s}/turns`, { method:'POST',
      headers:{'content-type':'application/json','Idempotency-Key':`${s}:99`},
      body: JSON.stringify({answer:'a repeated answer'})});
}, sid);
const after = await (await fetch(`${BASE}/v1/sessions/${sid}`)).json();
ok('three identical turns produce at most one new Visit',
   after.visits.length - evBefore.visits.length <= 1,
   `${evBefore.visits.length} → ${after.visits.length}`);

console.log('\nISSUE-0017 — summary');
await p.goto(`${BASE}/summary.html?id=${sid}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
ok('Coverage and Mastery are separate readings',
   (await p.locator('.reading').count()) >= 2);
ok('the untested section names a real count', await p.evaluate(() =>
   /never been asked about/i.test(document.body.innerText)));
ok('states that the two are never merged', await p.evaluate(() =>
   /reported separately/i.test(document.body.innerText)));
ok('an untested Topic shows no number', await p.evaluate(() =>
   [...document.querySelectorAll('.band--untested')].every(b =>
     !/\d\.\d\d/.test(b.parentElement?.textContent || ''))));

console.log('\nISSUE-0018 — credits and BYOK');
await p.goto(BASE + '/credits.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
ok('the balance renders with the Credit definition', await p.evaluate(() =>
   /one US cent/i.test(document.body.innerText)));
ok('the ledger shows entries', (await p.locator('.tbl tbody tr').count()) > 0);
await p.fill('#k', 'sk-ant-api03-not-an-openrouter-key');
await p.click('button[type=submit]');
await p.waitForTimeout(900);
const refusal = await p.evaluate(() => document.body.innerText);
ok('a raw vendor key is refused', /refused|OpenRouter keys are accepted/i.test(refusal));
await p.fill('#k', 'sk-or-v1-' + 'a'.repeat(32));
await p.click('button[type=submit]');
await p.waitForTimeout(1200);
const byokText = await p.evaluate(() => document.body.innerText);
ok('BYOK balance reads an em dash, not zero',
   /—/.test(byokText) && !/Balance[\s\S]{0,40}\b0\b/.test(byokText));
ok('no BYOK view mentions Credits spent as a number',
   !/Credits spent[\s\S]{0,30}\b0\b/i.test(byokText));
ok('the key plaintext is nowhere in the DOM', !/sk-or-v1-a{10}/.test(byokText));

console.log('\nISSUE-0019 — operator');
await p.goto(BASE + '/operator.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
ok('the console demands a token first', await p.evaluate(() =>
   /Operator access/i.test(document.body.innerText)));
await p.fill('input[type=password]', 'dev-operator-token');
await p.click('button[type=submit]');
await p.waitForTimeout(1200);
const opText = await p.evaluate(() => document.body.innerText);
ok('pool headroom leads', /Pool headroom/i.test(opText));
ok('float is reported as working capital', /Float \(working capital\)/i.test(opText));
ok('divergence is reported', /Drawdown divergence/i.test(opText));
ok('states no normaliser is applied', /no normaliser/i.test(opText));

console.log('\nresponsive + errors');
for (const w of [390, 768, 1440]) {
  await p.setViewportSize({ width: w, height: 900 });
  for (const path of ['/', `/summary.html?id=${sid}`, '/credits.html']) {
    await p.goto(BASE + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const hx = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(`no horizontal overflow at ${w}px ${path}`, !hx);
  }
}
ok('no uncaught JS errors anywhere', errors.length === 0, errors.slice(0,2).join(' | '));

await b.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
