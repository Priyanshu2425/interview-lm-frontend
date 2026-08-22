import { create } from "zustand";

export type ToastTone = "info" | "ok" | "risk";

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone: ToastTone;
}

let seq = 0;

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "tone"> & { tone?: ToastTone }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `t${++seq}`;
    set((s) => ({ toasts: [...s.toasts, { tone: "info", ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/* Read the action, not the list — a component that only pushes must not
   re-render every time another toast appears. */
export const useToast = () => useToastStore((s) => s.push);
