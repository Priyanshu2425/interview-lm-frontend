/* Who the browser tools are, now that identity is Gatehouse's (ADR-0026).
 *
 * These tools used to write a candidate id into `localStorage` and be believed.
 * That stopped working the day sign-in landed: the API answers `not_signed_in`,
 * and every tool died in its own setup before reaching a single assertion.
 *
 * So they sign in, as a member. There is no bypass and deliberately none added
 * — an env-gated header that skipped authentication would be a bypass that
 * exists in the production image, and the thing it would be protecting is the
 * only reason any of this is behind a login.
 *
 * The account is a real one, created once by an operator:
 *
 *   curl -s -X POST https://auth.buildspacelabs.com/auth/register \
 *     -H 'Content-Type: application/json' \
 *     -H 'X-App-Slug: interview-lm' \
 *     -d '{"email":"ci@…","password":"…"}'
 *
 * Its credentials reach these tools by environment and are never written down
 * here. A Gatehouse member cannot be deleted (ADR-0003) — it can only be
 * disabled — so this is an account somebody creates on purpose, once, and not
 * one a tool invents per run.
 */

const AUTH = (process.env.ILM_AUTH_URL || "https://auth.buildspacelabs.com").replace(/\/$/, "");
const SLUG = process.env.ILM_APP_SLUG || "interview-lm";

export const EMAIL = process.env.ILM_TEST_EMAIL || "";
export const PASSWORD = process.env.ILM_TEST_PASSWORD || "";

const MISSING =
  `\nThese tools sign in as a member, because the API requires it (ADR-0026).\n\n` +
  `Set the account's credentials:\n\n` +
  `  export ILM_TEST_EMAIL=…\n` +
  `  export ILM_TEST_PASSWORD=…\n\n` +
  `If the account does not exist yet, an operator creates it once — see the\n` +
  `comment at the top of tools/session.mjs. It is a real Gatehouse member and\n` +
  `cannot be deleted afterwards, only disabled.\n`;

export function requireCredentials() {
  if (EMAIL && PASSWORD) return;
  console.error(MISSING);
  process.exit(1);
}

/** An access token, for the tool's own requests.
 *
 *  Server-to-server, so no cookie and no Origin: the refresh cookie is the
 *  browser's mechanism and a Node script has no use for one. The token is
 *  short-lived and a tool run is shorter, so nothing here refreshes. */
export async function accessToken() {
  requireCredentials();
  const r = await fetch(`${AUTH}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-App-Slug": SLUG },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const text = await r.text();
  if (!r.ok) {
    console.error(
      `\nGatehouse refused the sign-in: ${r.status} ${text.slice(0, 200)}\n\n` +
      `Check ILM_TEST_EMAIL and ILM_TEST_PASSWORD, and that the account exists\n` +
      `for the "${SLUG}" tenant.\n`,
    );
    process.exit(1);
  }
  return JSON.parse(text).access_token;
}

/** Sign the *browser* in, through the form a Candidate uses.
 *
 *  Not by injecting a token: the surface keeps its access token in a module
 *  variable and rebuilds it from the refresh cookie, so there is nowhere to
 *  inject one — and driving the real form is what makes this a check of the
 *  path a Candidate actually takes rather than of a fixture. */
export async function signInPage(page, surface) {
  await page.goto(surface + "/login", { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
}

/** The Candidate this member is, as the server knows them.
 *
 *  Not invented. The tools used to make one up — `cand_e2e_x7f2q1` — and hand
 *  it to `/credits/grants`, which worked when the surface carried its own id.
 *  It does not any more: the candidate id is ours, opaque, and derived from
 *  the token (ADR-0012), so an invented one granted credits to a Candidate
 *  nobody was signed in as, and the member sat their Session with a balance of
 *  zero. `/v1/candidates/me` is where the real one comes from. */
export async function candidateId(token, base) {
  const r = await fetch(base + "/v1/candidates/me", {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    console.error(`\nSigned in, but ${base}/v1/candidates/me answered ${r.status}.\n`);
    process.exit(1);
  }
  return (await r.json()).candidate_id;
}
