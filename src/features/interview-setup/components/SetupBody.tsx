import { Button, ErrorState, Icon } from "@/ui";
import { engineLabel, privacyLine } from "@/features/dictation";
import type { Device } from "@/features/dictation";
import type { EngineId, MicOutcome, StepState } from "@/features/dictation";

/* The screen, as a function of what it is told (ISSUE-0053).
 *
 * Split from `InterviewSetupScreen` so it can be rendered with hand-built
 * props: every state below is one a Candidate can actually be in, and none of
 * them are reachable in a test that has to drive a real `getUserMedia` and a
 * real 172MB download to get there.
 */

/** Megabytes, from the bytes that actually arrived.
 *
 *  Computed and never written down. The ticket that proposed this screen said
 *  the model was 60MB; it is 172MB, and the figure had been copied between
 *  three documents by the time anybody measured it. A number the screen works
 *  out cannot drift from the thing it describes. */
function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
}

const STEP_COPY: ReadonlyArray<readonly [string, string]> = [
  ["Fixing the plan", "What you will be asked is decided once, now, and never changes."],
  ["Checking your microphone", "Asked for here so a permission box never lands on a running clock."],
  ["Getting ready to hear you", "A one-time setup on this machine. Instant every time after this."],
];

const SLOW_ENGINE_SUB = "A slow connection today. One-time download, kept afterwards.";

function headline(ready: boolean, typing: boolean, slow: boolean): string {
  if (ready && !typing) return "Everything is set. Begin when you are.";
  if (typing) return "You will be typing.";
  if (slow) return "Nearly there — your connection is slow today.";
  return "This takes a few seconds.";
}

/** What the Candidate is told about a check that did not pass.
 *
 *  Never "an error occurred": each of these has a different thing the
 *  Candidate can do about it, and one of them is our problem rather than
 *  theirs. */
function micNote(outcome: MicOutcome): string {
  if (outcome === "denied") {
    return "Your browser is not letting this page hear you. You can change that in the address bar — or begin now and type your answers.";
  }
  if (outcome === "no-device") {
    return "No microphone was found on this machine. You will type your answers, which changes nothing about how they are graded.";
  }
  return "Speaking needs a secure connection, and this page is not on one. That is ours to fix, not yours. You will type your answers.";
}

export interface SetupFacts {
  /** Absent when the response carried no count — Time and Scope render and
   *  this does not, rather than a number being invented for the slot. */
  questions: number | null;
  durationSeconds: number;
  modules: string[];
}

export interface SetupBodyProps {
  steps: [StepState, StepState, StepState];
  ready: boolean;
  typing: boolean;
  fatal: string | null;
  engine: EngineId | null;
  micOutcome: MicOutcome | null;
  engineReason: string | null;
  gestureNeeded: boolean;
  micAsked: boolean;
  download: {
    progress: number;
    loaded: number;
    total: number;
    slow: boolean;
    device: Device | null;
  };
  facts: SetupFacts;
  sessionId: string | null;
  beginning: boolean;
  beginError: string | null;
  onCheckMicrophone: () => void;
  onBegin: () => void;
  onCancel: () => void;
}

export function SetupBody({
  steps, ready, typing, fatal, engine, micOutcome, engineReason,
  gestureNeeded, micAsked, download, facts, sessionId,
  beginning, beginError, onCheckMicrophone, onBegin, onCancel,
}: SetupBodyProps) {
  const minutes = Math.round(facts.durationSeconds / 60);
  const pct = Math.round(download.progress * 100);

  /* Present in every state and in the same place, which is ISSUE-0049's "the
     screen says so" criterion. It names the engine that will actually run: on
     the Web Speech arm the audio does leave the machine, and a screen that
     said otherwise would be lying about a microphone in an examination. */
  const privacy = engine === null
    ? "You will type your answers. Nothing here listens."
    : privacyLine(engine);

  return (
    <div className="setup">
      <header className="setup-top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span className="brand-name">InterviewLM</span>
        </div>
        <div className="row g-5">
          <span className="tag">{facts.modules.length} Modules</span>
          <span className="tag">{minutes} min</span>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        </div>
      </header>

      <div className="setup-body">
        <div className="setup-col" data-stalled={download.slow || undefined}>
          {fatal !== null ? (
            <ErrorState
              title="The Session did not start"
              message={fatal}
              action={<Button onClick={onCancel}>Back to setup</Button>}
            />
          ) : (
            <>
              <span className="eyebrow">{ready && !typing ? "Ready" : "Setting up your interview"}</span>
              <h1 className="display-3 mt-4">{headline(ready, typing, download.slow)}</h1>

              {ready && !typing ? (
                <p className="prose mt-5" style={{ maxWidth: "52ch" }}>
                  The clock starts on the first question, not now. Answer out loud — you will read
                  back what we heard before any of it is sent.
                </p>
              ) : null}

              <div className="panel mt-8">
                <div className="steps">
                  {STEP_COPY.map(([title, sub], i) => {
                    const state = steps[i];
                    const engineSub = i === 2 && download.slow ? SLOW_ENGINE_SUB : sub;
                    return (
                      <div className="step" data-state={state} key={title}>
                        <span className="step-mark" aria-hidden="true">
                          {state === "done" ? <Icon name="check" size={12} />
                            : state === "fail" ? "!" : i + 1}
                        </span>
                        <span>
                          <span className="step-t">{title}</span>
                          <span className="step-sub">{engineSub}</span>
                        </span>
                        <StepRight index={i} state={state} pct={pct} />
                      </div>
                    );
                  })}
                </div>
                {!ready ? (
                  <div
                    className="meter"
                    style={{ borderRadius: "0 0 var(--r-md) var(--r-md)" }}
                    data-stalled={download.slow || undefined}
                  >
                    <i style={{ width: `${pct}%` }} />
                  </div>
                ) : null}
              </div>

              {micOutcome !== null && micOutcome !== "granted" ? (
                <div className="notice mt-7" data-tone="warn">
                  <span className="notice-ico"><Icon name="info" size={16} /></span>
                  <span className="grow stack g-4">
                    <strong className="h4">Answers will be typed</strong>
                    <span className="caption">{micNote(micOutcome)}</span>
                  </span>
                </div>
              ) : null}

              {engineReason !== null ? (
                <div className="notice mt-7" data-tone="warn">
                  <span className="notice-ico"><Icon name="info" size={16} /></span>
                  <span className="grow stack g-4">
                    <strong className="h4">Speaking is not available here</strong>
                    {/* The reason in the words it arrived in. */}
                    <span className="caption">{engineReason}</span>
                  </span>
                </div>
              ) : null}

              <div className="facts mt-7">
                {facts.questions !== null ? (
                  <div className="fact">
                    <span className="eyebrow">Questions</span>
                    <b>{facts.questions}</b>
                    <span className="caption">Fixed. It will not grow.</span>
                  </div>
                ) : null}
                <div className="fact">
                  <span className="eyebrow">Time</span>
                  <b>{minutes}m</b>
                  <span className="caption">From when you begin.</span>
                </div>
                <div className="fact">
                  <span className="eyebrow">Scope</span>
                  <b>{facts.modules.length}</b>
                  {/* The count, and not the names: this screen has module ids
                      and nothing else, and fetching names would add a request
                      to the critical path of every Session to caption a fact
                      the Candidate chose themselves one screen ago. */}
                  <span className="caption">Chosen on the previous screen.</span>
                </div>
              </div>

              <div className="row g-5 mt-8" style={{ flexWrap: "wrap" }}>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={!ready || beginning}
                  onClick={onBegin}
                >
                  {download.slow && !ready ? "Begin now and type" : "Begin the interview"}
                  <Icon name="right" size={14} />
                </Button>
                {gestureNeeded && !micAsked ? (
                  <Button onClick={onCheckMicrophone}>Check my microphone</Button>
                ) : null}
                {micOutcome === "denied" ? (
                  <Button onClick={onCheckMicrophone}>Try the microphone again</Button>
                ) : null}
              </div>

              {beginError !== null ? (
                <p className="caption mt-5" role="alert" style={{ color: "var(--risk)" }}>
                  {beginError}
                </p>
              ) : null}

              <details className="mt-8">
                <summary>What is happening</summary>
                <div className="tech mt-5">
                  <div className="tech-row">
                    <span>plan</span>
                    <b>{steps[0] === "done"
                      ? facts.questions !== null ? `fixed · ${facts.questions} questions` : "fixed"
                      : steps[0] === "fail" ? "not started" : "being fixed"}</b>
                  </div>
                  <div className="tech-row">
                    <span>microphone</span>
                    <b>{micOutcome ?? (gestureNeeded ? "not asked yet" : "asking")}</b>
                  </div>
                  <div className="tech-row">
                    <span>speech model</span>
                    <b>{engine === null ? "not used" : download.total > 0
                      ? `${engine} · ${pct}% of ${megabytes(download.total)}`
                      : engine}</b>
                  </div>
                  <div className="tech-row">
                    <span>runs on</span>
                    <b>{engine === null ? "—" : engineLabel(engine, download.device)}</b>
                  </div>
                  <div className="tech-row">
                    <span>uploaded</span>
                    <b>{engine === "webspeech" ? "audio, to your browser's vendor" : "nothing"}</b>
                  </div>
                  {download.slow ? (
                    <div className="tech-row">
                      <span>throughput</span>
                      <b style={{ color: "var(--warn)" }}>slow — under 250 KB/s</b>
                    </div>
                  ) : null}
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      <footer className="setup-foot">
        <span className="caption">{privacy}</span>
        <span className="caption mono dim">{sessionId ?? "—"}</span>
      </footer>
    </div>
  );
}

interface StepRightProps {
  index: number;
  state: StepState;
  pct: number;
}

function StepRight({ index, state, pct }: StepRightProps) {
  if (state === "done") return <span className="step-r">done</span>;
  if (state === "fail") {
    return <span className="step-r" style={{ color: "var(--warn)" }}>skipped</span>;
  }
  if (state !== "now") return null;
  if (index === 2) return <span className="step-r">{pct}%</span>;
  return <span className="spin" aria-hidden="true" />;
}
