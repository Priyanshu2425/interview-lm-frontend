import { create } from "zustand";

/* Auth is not built — ISSUE-0011 is HITL and the IdP is unchosen. The surface
   carries a candidate id it was given, and this is the one module that changes
   when real auth lands. */

const STORAGE_KEY = "ilm.candidate.v1";

function read(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = `cand_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return "cand_anonymous";
  }
}

interface IdentityState {
  candidateId: string;
  setCandidateId: (id: string) => void;
}

export const useIdentityStore = create<IdentityState>((set) => ({
  candidateId: read(),
  setCandidateId: (id) => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch { /* nothing to persist to */ }
    set({ candidateId: id });
  },
}));

export const useCandidateId = () => useIdentityStore((s) => s.candidateId);
