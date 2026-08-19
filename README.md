# Cortex Interviewer — surface

The Candidate and operator surface, built from the prototype in `../DESIGN/`
against the `/v1` contract in `../backend/`.

Its own repository. It talks to the backend over HTTP and shares nothing else
with it, which is the point of ADR-0009 letting the surface be a separate
deployable: it holds no invariant.

## Running it

The backend serves this folder as static files, so there is one origin and no
CORS to configure:

```bash
# from the parent project
docker run -d --name cortex-pg -e POSTGRES_PASSWORD=cortex \
  -e POSTGRES_USER=cortex -e POSTGRES_DB=cortex -p 55432:5432 postgres:16-alpine
.venv/bin/uvicorn interviewer.api.app:app --port 8000
# then open http://127.0.0.1:8000/
```

Point it elsewhere with `SURFACE_DIR`. To serve standalone during development,
`npm run dev` and proxy `/v1` to the API.

## Tests

```bash
node tests/run.mjs          # 44 checks, real browser, real API
```

They assert what a Candidate would observe, and several assert what must **not**
appear — no fused Coverage-and-Mastery figure, no Answer Key in the DOM before
grading, no Credit message on a BYOK view, no number on an untested Topic.

## Screens

| File | Issue | What it is |
|---|---|---|
| `index.html` | 0014 | Session setup — scope, duration, provider |
| `session.html` | 0015, 0016 | The exchange, and the Topic it closes |
| `summary.html` | 0017 | Coverage and Mastery, and what was never asked |
| `credits.html` | 0018 | Balance, ledger, BYOK |
| `operator.html` | 0019 | Pool, providers, Sessions |

## What is decided, and enforced here

- **The surface computes nothing.** Bands, Mastery, Coverage and Grading Modes
  arrive already decided. `PosteriorRidge` throws if constructed without a band,
  so a second implementation of the Evidence Floor cannot creep in.
- **Product rules are absent APIs.** `ReadingPair` takes Coverage and Mastery as
  two props and has no combined output.
- **One idempotency key per composed answer**, reused on every retry — a mashed
  button, a dropped connection and a refresh converge on one Answer Turn.
- **The surface composes no billing copy.** Failure messages render from the
  API's `code` and `message`, which is what keeps a Credit message from ever
  reaching a BYOK Candidate.
- **`CostChip` renders an em dash off the Credits route**, never `0` — zero reads
  as "it was free" rather than "this ledger does not apply to you".
- A timeout is a park, not an error: recovery reads the Session and resumes,
  the same path an interruption uses.

## Not built

Screens 06 (code editor) and 07 (voice) in `../DESIGN/` are future surfaces with
no endpoints, deliberately absent so nobody builds them by momentum.

Auth is not built — `api.js` carries a candidate id placeholder, and that is the
one place that changes when ISSUE-0011 lands.

Stack is vanilla ES modules rather than Astro; the reasoning and what would
reverse it are in `../docs/spec/0003-candidate-web-surface.md` §1a.
