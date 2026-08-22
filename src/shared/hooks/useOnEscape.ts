import { useEffect } from "react";

/* One document-level keydown per mounted consumer, removed on unmount. The
   handler is read from a ref inside the effect so a new inline closure on
   every render does not re-register the listener. */
export function useOnEscape(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, onEscape]);
}
