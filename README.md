# frontend

The Candidate and operator surface, built from the prototype in `DESIGN/`
against the `/v1` contract in `backend/`.

**Status: scaffold only.** This folder currently holds the design tokens and the
API client. The screens are specified in `docs/spec/0003-candidate-web-surface.md`
and issued as `docs/issues/0014`–`0020`; `0014` is startable now, since every
backend route it consumes is already built and tested.

```
frontend/
  assets/
    app.css   design tokens, lifted from DESIGN/assets/app.css
    api.js    the /v1 client, the idempotency key, and the auth placeholder
```

## What is already decided

- **The surface computes nothing.** Bands, Mastery, Coverage and Grading Modes
  arrive already decided. `PosteriorRidge` draws `(alpha, beta, band, label)`; it
  does not derive them.
- **Product rules are absent APIs.** `ReadingPair` takes Coverage and Mastery as
  two props and has no combined output, so a fused percentage cannot be added by
  accident.
- **One idempotency key per composed answer**, reused on every retry — a mashed
  button, a dropped connection and a refresh converge on one Answer Turn.
- **The surface composes no billing copy.** Failure messages are rendered from
  the API's `code` and `message`; that is what keeps a Credit message from ever
  reaching a BYOK Candidate.
- Stack is vanilla ES modules, not Astro. The reason, and what would reverse it,
  are recorded in SPEC-0003 §1a.

`DESIGN/` remains the design's source of truth and is not replaced by this
folder — ISSUE-0020 compares the built screens against it.
