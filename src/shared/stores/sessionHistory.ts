import { create } from "zustand";

/* Which Sessions this browser has seen. Sessions are resumable and the id is
   the only handle on one, so losing it would strand a Session that the server
   still holds open. Kept small on purpose: five entries, ids and titles only. */

export interface SessionStub {
  id: string;
  startedAt: number;
  moduleCount: number;
  durationSeconds: number;
  state: "running" | "ended";
}

const STORAGE_KEY = "ilm.sessions.v1";
const LIMIT = 5;

function read(): SessionStub[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SessionStub[]).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

function write(list: SessionStub[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch { /* nothing to persist to */ }
}

interface HistoryState {
  sessions: SessionStub[];
  remember: (stub: SessionStub) => void;
  markEnded: (id: string) => void;
}

export const useSessionHistory = create<HistoryState>((set) => ({
  sessions: read(),
  remember: (stub) =>
    set((s) => {
      const next = [stub, ...s.sessions.filter((x) => x.id !== stub.id)].slice(0, LIMIT);
      write(next);
      return { sessions: next };
    }),
  markEnded: (id) =>
    set((s) => {
      const next = s.sessions.map((x) => (x.id === id ? { ...x, state: "ended" as const } : x));
      write(next);
      return { sessions: next };
    }),
}));

export const useLatestSession = () => useSessionHistory((s) => s.sessions[0] ?? null);
export const useLatestRunningSession = () =>
  useSessionHistory((s) => s.sessions.find((x) => x.state === "running") ?? null);
