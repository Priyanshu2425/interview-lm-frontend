# InterviewLM — surface

The Candidate and Operator surface, built against the `/v1` contract in
`../backend/`, in the InterviewLM design system documented in `../DESIGN.md`.

Its own repository. It talks to the backend over HTTP and shares nothing else
with it, which is the point of ADR-0009 letting the surface be a separate
deployable: it holds no invariant.

## Running it

The backend serves `dist/` as static files, so locally there is one origin and
no CORS to configure. That is still the default everywhere — `ALLOWED_ORIGINS`
on the API and `VITE_API_URL` here are both empty until somebody splits them,
and empty is this deployment exactly as described. The deployed surface *is*
split: it is served from Cloudflare Pages and reaches the API cross-origin,
which is what ADR-0020 records and what those two variables are for.

```bash
npm install
npm run build

# from the parent project
docker run -d --name cortex-pg -e POSTGRES_PASSWORD=cortex \
  -e POSTGRES_USER=cortex -e POSTGRES_DB=cortex -p 55432:5432 pgvector/pgvector:pg16
.venv/bin/uvicorn interviewer.api.app:app --port 8000
# then open http://127.0.0.1:8000/
```

`SURFACE_DIR` points the mount elsewhere. To develop with hot reload,
`npm run dev` proxies `/v1` to `http://127.0.0.1:8000` — still one origin from
the browser's point of view.

Set `INTERVIEWER_FAKE_MODEL=1` on the API to run the whole loop against a
scripted provider: deterministic, no network, real metering.

## Signing in while developing

**Run this once per machine, then `npm run dev`:**

```bash
../scripts/dev-auth-setup.sh
```

It is idempotent — it checks each step before acting, so running it again on a
machine that is already set up prints what is already true and changes nothing.
It asks for your password twice at most: once for the local certificate
authority, once for `/etc/hosts`, and only if those are not already done.

Then:

```bash
npm run dev                               # serves https://interview-lm.dev.buildspacelabs.com:5173
```

### What it sets up, and why

Identity is held by [Gatehouse](https://auth.buildspacelabs.com), and its refresh
cookie is `httpOnly`, `Secure` and `SameSite=Lax`. Two of those decide how this
surface has to be served locally, and getting either wrong produces the same
failure: **sign-in appears to work and the session is gone by the next reload**,
with nothing logged anywhere.

| | |
|---|---|
| `SameSite=Lax` | needs this surface and the auth host to be **one site**. `interview-lm.dev.buildspacelabs.com` and `auth.buildspacelabs.com` share `buildspacelabs.com`, so the cookie is sent. This is why the dev server is not on `localhost`. |
| `Secure` | needs **https**. That is why `npm run dev` serves TLS with a locally-trusted certificate rather than plain http. |
| the hostname | is `interview-lm.dev.buildspacelabs.com` because in Gatehouse an origin belongs to exactly one tenant, so every product's developers would otherwise be fighting over `localhost:5173`. The label is this tenant's slug. It resolves to `127.0.0.1`; nothing leaves the machine. |

`vite.config.ts` reads the certificate from `~/.local/share/gatehouse-dev-certs/`
and **falls back to plain http with a warning if it is not there** — so a
teammate without one still gets a dev server that starts, and only signing in is
broken.

### When something is wrong

| Symptom | Cause | Fix |
|---|---|---|
| `getaddrinfo ENOTFOUND interview-lm.dev.buildspacelabs.com` | the name is not resolving on this machine — usually a stale macOS resolver cache, sometimes a resolver that refuses loopback answers for public names | re-run `../scripts/dev-auth-setup.sh`; it adds an `/etc/hosts` entry |
| Browser warns the certificate is untrusted | the local CA is not in the system trust store | `mkcert -install` |
| Sign-in works, then the member is signed out on reload | the page is on plain http, so the `Secure` cookie was never sent | check `npm run dev` printed an `https://` URL, not `http://` |
| CORS refusal the page reads as a network error | this origin is not registered against the tenant | step 5 of the script prints the exact command for an operator |
| Port already in use | `strictPort` is deliberate — a silent move to another port ends as an unreadable CORS error | free the port rather than changing it; the registered origin names this one |

### Why not just use plain http on localhost

Gatehouse can put a tenant in **token mode**, where the refresh token is returned
in the response body instead of a cookie. That exists for front ends on
`*.pages.dev` or `*.vercel.app`, which are their own site to a browser and can
never be same-site with any auth host — for them there is no alternative.

This tenant is not one of those. Choosing token mode here would permanently
weaken the session protection of real members in production to save a
certificate on one laptop, and Gatehouse prints a note at every deploy naming
tenants that did exactly that.

## Layout

Feature-based. Everything a feature owns lives with it, and a feature is
reached through its `index.ts` — enforced by an ESLint `no-restricted-imports`
rule, so moving a file inside a feature cannot break anything outside it.

```
src/
├── routes/            React Router — routing and layout only
│   ├── index.tsx      route table; heavy routes are lazy
│   └── layouts/       RootLayout: the shell, and the rail's spend readout
│
├── features/          vertical slices
│   ├── session-setup/ scope, duration, provider · the rules in force
│   ├── examination/   the exchange, the composer, the closed Visit
│   ├── mastery/       the corpus map, the readings, what was never asked
│   ├── evidence/      one row per Topic Visit, and its grounding
│   ├── notebook/      ingest, the Adapter's state, the two doors
│   ├── credits/       balance, ledger, BYOK
│   ├── settings/      defaults, surface behaviour, appearance, identity
│   └── operator/      pool headroom, per-Provider spend, metering health
│
├── shared/            used by two or more features
│   ├── components/    AppShell, PageHeader, Workbench, ThemeSwitcher
│   ├── hooks/         useMediaQuery, useCountdown, useDebounced, useOnEscape
│   ├── stores/        theme, identity, preferences, session history, toasts
│   ├── types/         the /v1 contract, as types
│   └── utils/         cn, band mapping, formatters
│
├── ui/                design system primitives
│   ├── styles/        tokens · system · patterns · shell
│   └── data/beta.ts   the Beta density, as a path
│
├── lib/               infrastructure
│   ├── api-client.ts  fetch, ApiError, the idempotency key
│   ├── endpoints.ts   every path the surface knows
│   ├── query-keys.ts  type-safe cache keys
│   └── services/      one module per resource
│
└── test/setup.ts
```

## Code Practices

See [CODE_PRACTICES.md](./CODE_PRACTICES.md) for comprehensive coding guidelines including:
- Import conventions and path aliases
- Component patterns (named functions, no inline definitions)
- State management (local, Zustand, TanStack Query)
- Data fetching patterns (parallel queries, dependent queries)
- Performance optimization (memoization, code splitting)
- Testing patterns
- CSS and styling conventions

## What is decided, and enforced here

- **The surface computes nothing.** Bands, Mastery, Coverage and Grading Modes
  arrive already decided. `BetaCurve` cannot be rendered without a band, and
  `bandClass` has no branch that inspects a mastery figure — a second
  implementation of the Evidence Floor would drift from the first.
- **Product rules are absent APIs.** There is no call anywhere that returns a
  fused Coverage-and-Mastery figure, and `Reading` renders the word *Untested*
  even when a mastery number is passed in beside an untested band.
- **One idempotency key per composed answer**, reused on every retry and only
  advanced when a turn actually lands. A mashed button, a dropped connection
  and a refresh converge on one Answer Turn.
- **The surface composes no billing copy.** Failure messages render from the
  API's `code` and `message`, which is what keeps a Credit message from ever
  reaching a BYOK Candidate — including the Provider price history, which is a
  Credit figure and therefore a Credits view.
- **`CostValue` renders an em dash off the Credits route**, never `0`.
- **Controls that reach nothing are absent.** The design's Evidence Floor and
  probe-depth sliders are not on the setup screen, because `POST /sessions`
  takes no such fields; the rules of evidence are shown as the rules in force
  instead. There is no "ask for a hint" button, because the graph decides that
  move and no route exists for the Candidate to request it.
- **A timeout is a park, not an error.** Recovery reads the Session and
  resumes, the same path an interruption uses.

## Checks

`verify` is self-contained. Everything below it drives a real browser against a
real API **and signs in**, so it needs three things running or set — the tools
say which, in one line, rather than failing from inside Playwright.

```bash
npm run verify      # typecheck · lint · unit tests · build — no server needed

# 1. the API, from the project root:
#      .venv/bin/uvicorn interviewer.app:app --port 8000 --env-file backend/.env
# 2. the surface, from here:
#      npm run dev
# 3. the account these tools sign in as:
export ILM_TEST_EMAIL=…
export ILM_TEST_PASSWORD=…

npm run test:e2e    # 41 checks, real browser, real API
npm run audit       # contrast, targets, names — 5 variations × 8 routes
```

**Two origins, and they are not interchangeable.** `BASE` is the API
(`http://127.0.0.1:8000`); `SURFACE` is where the pages are
(`https://interview-lm.dev.buildspacelabs.com:5173`). They were one origin
until ADR-0020, when the API stopped serving `dist/` — a tool pointed at the
API now gets a JSON 404 where it expected a screen. The surface host is not
`localhost` on purpose: Gatehouse's refresh cookie is `Secure` and
`SameSite=Lax`, so it is only sent from an https origin that is same-site with
the auth host. `backend/scripts/dev-auth-setup.sh` sets that up, once per
machine.

**The account is a real Gatehouse member.** Identity is Gatehouse's (ADR-0026)
and there is no bypass — an env-gated header that skipped authentication would
be a bypass shipped in the production image. An operator creates it once:

```bash
curl -s -X POST https://auth.buildspacelabs.com/auth/register \
  -H 'Content-Type: application/json' -H 'X-App-Slug: interview-lm' \
  -d '{"email":"ci@example.com","password":"a long enough one"}'
```

A member cannot be deleted (Gatehouse ADR-0003), only disabled — so this is an
account made deliberately, once, and not one a tool invents per run. It also
needs Credits; the tools grant them to themselves, against the candidate id
they read back from `/v1/candidates/me` rather than one they made up.

`npm run audit` measures rather than asserts: it computes every rendered text
node's contrast against its real backdrop, checks every target's box on both a
fine and a coarse pointer, looks for unnamed controls, and fails if any route
scrolls sideways at 320px.

The e2e suite asserts what a Candidate would observe, and several checks assert
what must **not** appear: no fused figure, no number on an Untested Topic, no
difficulty label, no Answer Key text, no Credit figure on a BYOK ledger, and no
Session price quoted in advance.

Screenshots, when you want to look rather than assert:

```bash
node tools/shoot.mjs <out-dir> [variation]   # every route × desktop/tablet/phone
node tools/scenes.mjs <out-dir> [variation]  # states a route shot cannot reach
```

## Not built

The code editor is a future surface with no endpoint, deliberately absent so
nobody builds it by momentum. Voice was that too, until ISSUE-0049: the
Candidate speaks, the browser transcribes, and the turn reaches the API as text
with `spoken: true`.

Auth is not built. `shared/stores/identity.ts` carries a candidate id the
browser generated, and that is the one module that changes when ISSUE-0011
lands.
