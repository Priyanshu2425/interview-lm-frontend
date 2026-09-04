import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/ui";
import {
  attachMeter, cancelListening, engineLabel, looksLikeSilence, privacyLine,
  setMode, startListening, stopListening, useDictationStore,
} from "@/features/dictation";

import { MicButton } from "./MicButton";
import { LevelMeter } from "./LevelMeter";
import { ReviewBox } from "./ReviewBox";
import { Composer } from "./Composer";

/* Press, speak, stop, transcribe, read it back, submit (ISSUE-0054).
 *
 * The confirmation step is not a nicety, it is the design: nothing reaches the
 * grader that the Candidate has not seen in an editable field. See
 * `ReviewBox` for why that matters more here than it would anywhere else.
 *
 * Nothing here computes anything about the answer. No word count, no "that
 * seems short", no confidence figure — the surface has no view about whether
 * an answer is any good, which is the Judge's job and deliberately not this
 * screen's.
 */

type Stage = "idle" | "listening" | "review";

interface VoiceComposerProps {
  disabled: boolean;
  sending: boolean;
  /* `spoken` is optional so the same handler satisfies `Composer`, which is
     unmodified in this slice and calls it with one argument. The default —
     false — is what makes a typed answer typed. */
  onSubmit: (answer: string, spoken?: boolean) => void;
  error: string | null;
  onRetry: () => void;
  footRef?: React.Ref<HTMLDivElement>;
}

/** The sentence the live region carries, one per state.
 *
 *  For the Candidate rather than for `tools/a11y.mjs` — `ToastHost` already
 *  satisfies the tool's live-region check globally. Somebody who cannot see
 *  the microphone turn red needs to be told it is listening. */
function announcement(stage: Stage, phase: string, heard: string | null): string {
  if (phase === "transcribing") return "Writing down what you said.";
  if (stage === "listening") return "Listening.";
  if (stage === "review") return "Transcribed — read it back before sending.";
  if (heard === "silent") return "Nothing was heard.";
  if (heard === "too-short") return "That was too short to write down.";
  return "";
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function VoiceComposer({
  disabled, sending, onSubmit, error, onRetry, footRef,
}: VoiceComposerProps) {
  const phase = useDictationStore((s) => s.phase);
  const engine = useDictationStore((s) => s.engine);
  const device = useDictationStore((s) => s.device);
  const progress = useDictationStore((s) => s.progress);
  const heard = useDictationStore((s) => s.heard);
  const reason = useDictationStore((s) => s.reason);

  const [stage, setStage] = useState<Stage>("idle");
  const [draft, setDraft] = useState("");
  const [spokenSeconds, setSpokenSeconds] = useState<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const halo = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);

  const listening = stage === "listening";
  const busy = phase === "transcribing";

  /* The recording clock. One interval, only while listening, and it does
     nothing but tick — the clock is zeroed in the event handler that starts
     the recording, because a `setState` in an effect renders twice for a value
     that was already known when the button was pressed. */
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250);
    return () => clearInterval(id);
  }, [listening]);

  /* Nothing is left running when the composer goes. `ExaminationScreen`
     unmounts this for every question, and a recording that survived that would
     be a microphone open across a question it was not started for. */
  useEffect(() => () => cancelListening(), []);

  const stop = useCallback(() => {
    setSpokenSeconds((Date.now() - startedAt.current) / 1000);
    void stopListening().then((recording) => {
      const text = recording.result?.text ?? "";
      /* Nothing is sent in either silence, and the question is unchanged.
         `looksLikeSilence` is what stops "Thank you." — which is what the
         model emits when fed a room — being graded as an Answer Turn. */
      if (recording.heard !== "speech" || looksLikeSilence(text)) {
        setStage("idle");
        return;
      }
      setDraft(text);
      setStage("review");
    }).catch(() => setStage("idle"));
  }, []);

  const toggle = useCallback(() => {
    if (listening) { stop(); return; }
    void startListening().then((outcome) => {
      if (outcome !== "granted") {
        setDenied(true);
        setStage("idle");
        return;
      }
      startedAt.current = Date.now();
      setElapsed(0);
      setStage("listening");
    });
  }, [listening, stop]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || sending) return;
    /* True even though they may have corrected it: it is still a machine's
       reading of a voice, which is exactly the audit question the field exists
       to answer (ISSUE-0050). It is false only when they typed from scratch. */
    onSubmit(text, true);
    setDraft("");
    setStage("idle");
  }, [draft, sending, onSubmit]);

  const redo = useCallback(() => { setDraft(""); setStage("idle"); }, []);
  const toType = useCallback(() => setMode("type"), []);

  /* ⌘↵ stops the recording while listening; in review, `ReviewBox` owns it and
     it submits. Two meanings, and both are "finish what you are doing". */
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); stop(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [listening, stop]);

  const live = announcement(stage, phase, heard);

  /* The microphone was refused. The Session is fine and the question is still
     theirs — so the typing composer renders inline, and the way back to the
     microphone is one button. */
  if (denied || phase === "unavailable") {
    return (
      <div className="composer" ref={footRef}>
        <div className="notice" data-tone="risk" role="alert">
          <span className="notice-ico"><Icon name="info" size={16} /></span>
          <span className="grow stack g-4">
            <strong className="h4">This browser will not give us the microphone.</strong>
            <span className="caption">
              {reason ?? "Nothing is lost — the Session is open and the question is still yours to answer. Allow the microphone in the address bar and speak, or type this one."}
            </span>
          </span>
        </div>
        <Composer
          disabled={disabled}
          sending={sending}
          onSubmit={onSubmit}
          error={error}
          onRetry={onRetry}
        />
        <div className="hint-row">
          <Button variant="quiet" size="sm" onClick={() => { setDenied(false); toggle(); }}>
            Try the microphone again
          </Button>
        </div>
      </div>
    );
  }

  /* Rare: setup normally finishes the model before the clock starts, so
     somebody here either skipped setup or the first question outran the
     download. No megabytes — they are mid-examination, and the only fact that
     helps them is that they can type this one right now. */
  if (phase === "preparing") {
    return (
      <div className="composer" ref={footRef}>
        <div className="vbox" data-busy="">
          <div className="load">
            <div className="between">
              <span className="eyebrow">Nearly ready to hear you</span>
              <span className="mono dim">{Math.round(progress * 100)}%</span>
            </div>
            <div className="meter"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p className="caption">
              This finishes setting up in the background. Do not wait for it — type this
              answer and speak the next one.
            </p>
          </div>
          <div className="vbox-foot">
            <span className="caption">The clock is running.</span>
            <Button variant="primary" size="sm" onClick={toType}>Type this answer</Button>
          </div>
        </div>
        <p className="visually-hidden" role="status" aria-live="polite">{live}</p>
      </div>
    );
  }

  return (
    <div className="composer" ref={footRef}>
      {error ? (
        <div className="composer-error" role="alert">
          <Icon name="info" size={15} />
          <span className="body-sm grow">{error}</span>
          <Button variant="quiet" size="sm" onClick={onRetry}>Send it again</Button>
        </div>
      ) : null}

      {/* The two silences, told apart (ISSUE-0052). Nothing was sent in either
          case and the question is unchanged, but they are different problems:
          one is a muted microphone, the other is a room. */}
      {stage === "idle" && heard !== null && heard !== "speech" ? (
        <div className="notice" data-tone="warn" role="alert">
          <span className="notice-ico"><Icon name="info" size={16} /></span>
          <span className="grow stack g-4">
            <strong className="h4">
              {heard === "silent"
                ? "Nothing reached the microphone."
                : "We heard the room, but no speech."}
            </strong>
            <span className="caption">
              Nothing was sent and the question is unchanged. Check the right microphone
              is selected, then go again.
            </span>
          </span>
        </div>
      ) : null}

      {stage === "review" ? (
        <ReviewBox
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          onRedo={redo}
          sending={sending}
          spokenLabel={spokenSeconds === null ? null : clock(spokenSeconds)}
        />
      ) : (
        <div className="vbox" data-live={listening ? "" : undefined} data-busy={busy ? "" : undefined}>
          <div className="vbox-main">
            <div className="row g-7">
              <MicButton
                listening={listening}
                disabled={busy || sending || disabled}
                onToggle={toggle}
                haloRef={halo}
              />
              <span className="grow stack g-4">
                {listening ? (
                  <>
                    <span className="row g-6">
                      <span className="mic-clock">{clock(elapsed)}</span>
                      <LevelMeter attach={attachMeter} haloRef={halo} live />
                    </span>
                    <span className="caption">
                      Listening. Press again — or ⌘↵ — when you have finished the thought.
                    </span>
                  </>
                ) : busy ? (
                  <>
                    <span className="h4">Writing down what you said.</span>
                    {/* Measured at 0.37–0.45× realtime (ISSUE-0052). The
                        prototype said "a few seconds", which is false for a
                        forty-second answer — and a false wait is worse than a
                        long one, because the Candidate starts wondering
                        whether the button worked. */}
                    <span className="caption">
                      This takes about half as long as you spoke for. Nothing has been sent.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h4">Answer out loud.</span>
                    <span className="caption">
                      Press the button, or hold <b className="mono">Space</b>. You read it
                      back before it goes.
                    </span>
                  </>
                )}
              </span>
              {busy ? <span className="tag" data-tone="accent">transcribing</span> : null}
            </div>
          </div>
          <div className="vbox-foot">
            <span className="modes" role="group" aria-label="How you answer">
              <button type="button" aria-pressed={true} data-mode="speak">Speak</button>
              <button type="button" aria-pressed={false} data-mode="type" onClick={toType}>Type</button>
            </span>
            <div className="row g-5">
              <span className="tag">{engineLabel(engine, device)}</span>
              {/* The claim matches the engine that actually ran. */}
              <span className="caption">{privacyLine(engine)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="hint-row">
        <span className="kbd">Space to talk · ⌘↵ to submit</span>
        <span className="kbd">
          A hint, if the examiner offers one, lowers this answer&rsquo;s weight.
        </span>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">{live}</p>
    </div>
  );
}
