# InterviewLM — surface

The Candidate and Operator surface, built against the `/v1` contract in
`../backend/`, in the InterviewLM design system documented in `../DESIGN.md`.

Its own repository. It talks to the backend over HTTP and shares nothing else
with it, which is the point of ADR-0009 letting the surface be a separate
deployable: it holds no invariant.

## Running it

The backend serves `dist/` as static files, so there is one origin and no CORS
to configure.

```bash
npm install
npm run build

# from the parent project
docker run -d --name cortex-pg -e POSTGRES_PASSWORD=cortex \
  -e POSTGRES_USER=cortex -e POSTGRES_DB=cortex -p 55432:5432 postgres:16-alpine
.venv/bin/uvicorn interviewer.api.app:app --port 8000
# then open http://127.0.0.1:8000/
```

`SURFACE_DIR` points the mount elsewhere. To develop with hot reload,
`npm run dev` proxies `/v1` to `http://127.0.0.1:8000` — still one origin from
the browser's point of view.

Set `INTERVIEWER_FAKE_MODEL=1` on the API to run the whole loop against a
scripted provider: deterministic, no network, real metering.

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
real API, so start the backend first — the tools say so and name the command
rather than failing from inside Playwright.

```bash
npm run verify      # typecheck · lint · unit tests · build — no server needed

# from the project root, in another terminal:
#   INTERVIEWER_FAKE_MODEL=1 .venv/bin/uvicorn interviewer.api.app:app --port 8000

npm run test:e2e    # 41 checks, real browser, real API
npm run audit       # contrast, targets, names — 5 variations × 8 routes
```

`BASE=http://host:port` points any of them at a different deployment.

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

The code editor and voice surfaces are future surfaces with no endpoints,
deliberately absent so nobody builds them by momentum.

Auth is not built. `shared/stores/identity.ts` carries a candidate id the
browser generated, and that is the one module that changes when ISSUE-0011
lands.
