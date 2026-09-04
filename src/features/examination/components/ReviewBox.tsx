import { useEffect, useRef } from "react";
import { Button, Icon } from "@/ui";

/* The transcript, before it is an Answer Turn (ISSUE-0054).
 *
 * This box is the whole design. Whisper gets technical vocabulary wrong in a
 * way that is invisible to the person who said it — "PyTorch" comes back "pie
 * torch", "ReLU" comes back "rely you" — and the Session is graded on this
 * text, Topic by Topic, at the end. Coverage is a reading of whether a Topic
 * was addressed at all, so a mistranscribed term is a Topic the Candidate
 * covered and the record says they did not, and they never find out.
 *
 * A real `<textarea>` and not `contenteditable`. Three reasons, and the first
 * two are the ones that matter: `tests/run.mjs` fills `#answer`, and
 * contenteditable has genuinely bad IME and undo behaviour — which in a graded
 * examination is not a cosmetic problem. When per-word marking becomes
 * possible the technique is an `aria-hidden` mirror div under a
 * transparent-text textarea, and the textarea survives that either way.
 */

interface ReviewBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRedo: () => void;
  sending: boolean;
  /** How long they spoke for, as the tag on the box. */
  spokenLabel: string | null;
}

export function ReviewBox({ value, onChange, onSubmit, onRedo, sending, spokenLabel }: ReviewBoxProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /* Focused on arrival, because the one thing to do here is read it and fix
     what is wrong. */
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="vbox">
      <div className="vbox-main stack g-6">
        <div className="between">
          <span className="eyebrow">What we heard — yours to fix</span>
          {spokenLabel ? <span className="tag" data-tone="accent">{spokenLabel} spoken</span> : null}
        </div>
        <label className="visually-hidden" htmlFor="answer">Your answer, as transcribed</label>
        <textarea
          id="answer"
          className="said"
          ref={ref}
          value={value}
          disabled={sending}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit(); }
          }}
        />
        {/* Claims only what is true. The prototype said two words were
            underlined because the model was unsure of them — a measurement
            this surface does not have and cannot get (ISSUE-0052). */}
        <span className="caption">
          It grades what is written here, not what you remember saying. Technical terms are
          what it gets wrong — read those.
        </span>
      </div>
      <div className="vbox-foot">
        <div className="row g-5">
          <button
            type="button"
            className="mic mic--sm"
            aria-label="Record again"
            disabled={sending}
            onClick={onRedo}
          >
            <Icon name="resume" size={17} />
          </button>
          <span className="caption">Say it again</span>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={onSubmit}
          disabled={sending || value.trim().length === 0}
          loading={sending}
          loadingLabel="Sending…"
        >
          Submit answer
        </Button>
      </div>
    </div>
  );
}
