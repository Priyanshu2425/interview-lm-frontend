import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOnEscape } from "@/shared/hooks";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}

/* One dialog per view, always with a scrim, and only for a task that genuinely
   needs protected focus — ending a Session early is one, because the answer
   is irreversible for the record being built. */
export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useOnEscape(open, onClose);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    /* Focus stays inside while the dialog is up. Without this, tabbing walks
       out into a page the Candidate cannot see. */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !node) return;
      const focusable = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreTo.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={panel}>
        <div className="dialog-head"><h2 className="h3" id="dialog-title">{title}</h2></div>
        <div className="dialog-body body-sm">{children}</div>
        <div className="dialog-foot">{footer}</div>
      </div>
    </>,
    document.body,
  );
}
