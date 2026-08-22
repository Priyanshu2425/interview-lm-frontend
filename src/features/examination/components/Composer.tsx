import { useCallback, useRef, useState } from "react";
import type { Ref } from "react";
import { Button, Icon } from "@/ui";

interface ComposerProps {
  disabled: boolean;
  sending: boolean;
  onSubmit: (answer: string) => void;
  error: string | null;
  onRetry: () => void;
  /* The transcript scrolls this into view after every turn, so the newest
     question and the box you answer it in are on screen together. */
  footRef?: Ref<HTMLDivElement>;
}

/* The Answer Turn is a submit event, so this is fully keyboard-operable:
   Cmd/Ctrl+Enter sends, and the button never moves.

   There is no "ask for a hint" control. The examiner offers one when it judges
   one useful — the graph decides the move — and no route exists for the
   Candidate to request it. A button that did nothing would be worse than its
   absence, so the rule is stated instead. */
export function Composer({ disabled, sending, onSubmit, error, onRetry, footRef }: ComposerProps) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const send = useCallback(() => {
    const text = value.trim();
    if (!text || sending || disabled) return;
    onSubmit(text);
    setValue("");
    ref.current?.focus();
  }, [value, sending, disabled, onSubmit]);

  return (
    <div className="composer" ref={footRef}>
      {error ? (
        <div className="composer-error" role="alert">
          <Icon name="info" size={15} />
          <span className="body-sm grow">{error}</span>
          <Button variant="quiet" size="sm" onClick={onRetry}>Send it again</Button>
        </div>
      ) : null}

      <div className="composer-box">
        <label className="visually-hidden" htmlFor="answer">Your answer</label>
        <textarea
          id="answer"
          ref={ref}
          value={value}
          disabled={disabled || sending}
          placeholder="Explain it as if the follow-up is already coming."
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          }}
        />
        <div className="composer-foot">
          <span className="caption composer-note">
            A hint, if the examiner offers one, is recorded and lowers this answer&rsquo;s weight.
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={send}
            disabled={disabled || value.trim().length === 0}
            loading={sending}
            loadingLabel="Sending…"
          >
            Submit answer
          </Button>
        </div>
      </div>
      <p className="caption composer-kbd">⌘↵ to submit</p>
    </div>
  );
}
