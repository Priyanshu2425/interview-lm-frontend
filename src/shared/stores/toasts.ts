import { create } from "zustand";

export type ToastTone = "info" | "ok" | "risk";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: ToastTone;
}

let seq = 0;

/* How long a toast stays before it takes itself away.
 *
 * Long, deliberately: several of these carry the API's own refusal — why an
 * upload was declined, why a Session parked — and a message that vanishes
 * before it has been read is the same as no message. A click ends one sooner. */
export const TOAST_MS = 20_000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "tone"> & { tone?: ToastTone }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = `t${++seq}`;
    set((s) => ({ toasts: [...s.toasts, { tone: "info", ...toast, id }] }));
    /* Held here rather than in the component: a toast must expire whether or
       not anything is rendering it, and a timer owned by a component that
       unmounts leaves the toast on screen for ever. */
    timers.set(id, setTimeout(() => get().dismiss(id), TOAST_MS));
    return id;
  },
  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/* Read the action, not the list — a component that only pushes must not
   re-render every time another toast appears. */
export const useToast = () => useToastStore((s) => s.push);
