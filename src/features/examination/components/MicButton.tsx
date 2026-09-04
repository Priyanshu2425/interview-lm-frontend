import { useEffect, useRef } from "react";
import { Icon } from "@/ui";

/* One control, two states (ISSUE-0054).
 *
 * Idle and listening are the same button rather than a Start and a Stop, so
 * there is never a question of which one ends the recording — and never a
 * moment where the Candidate has pressed Start twice.
 */

interface MicButtonProps {
  listening: boolean;
  disabled: boolean;
  onToggle: () => void;
  /** The halo, scaled by the level meter. Held here because it belongs to the
   *  button visually and to the meter behaviourally. */
  haloRef: React.RefObject<HTMLDivElement | null>;
}

export function MicButton({ listening, disabled, onToggle, haloRef }: MicButtonProps) {
  const button = useRef<HTMLButtonElement>(null);

  /* Space to talk, bound to the button and never to the document. A
     document-level Space handler on a screen whose main control is a textarea
     would eat every space the Candidate types — the composer is one tab away,
     and typing is the fallback this whole feature falls back to. */
  useEffect(() => {
    const el = button.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return;
      /* The browser fires `click` on Space for a button anyway; preventing the
         default here stops it arriving twice. */
      e.preventDefault();
      if (e.repeat) return;
      onToggle();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [onToggle]);

  return (
    <div className="mic-wrap" data-live={listening ? "" : undefined} ref={haloRef}>
      <button
        ref={button}
        type="button"
        className="mic mic--lg"
        data-state={listening ? "listening" : "idle"}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop and transcribe" : "Start speaking"}
        onClick={onToggle}
      >
        <Icon name={listening ? "stop" : "mic"} size={listening ? 26 : 28} />
      </button>
    </div>
  );
}
