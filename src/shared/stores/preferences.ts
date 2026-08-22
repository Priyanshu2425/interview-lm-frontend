import { create } from "zustand";

/* What the surface actually remembers between Sessions.

   Every field here reaches something real: `provider` and `defaultDuration`
   are arguments to POST /sessions, and the other two govern behaviour the
   surface itself owns. Nothing that the contract does not accept is stored as
   though it were a setting — a control that changes nothing is worse than an
   absent one. */

export interface Preferences {
  provider: string;
  defaultDuration: number;
  openGroundingFirst: boolean;
  confirmBeforeEnding: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  provider: "deepseek",
  defaultDuration: 3000,
  openGroundingFirst: true,
  confirmBeforeEnding: true,
};

const STORAGE_KEY = "ilm.prefs.v2";

function read(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    /* Unknown keys are dropped and missing ones take the default, so a stale
       shape from an older build can never crash a render. */
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

interface PreferenceState {
  prefs: Preferences;
  save: (next: Preferences) => void;
  reset: () => void;
}

export const usePreferenceStore = create<PreferenceState>((set) => ({
  prefs: read(),
  save: (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* nothing to persist to */ }
    set({ prefs: next });
  },
  reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* nothing to remove */ }
    set({ prefs: DEFAULT_PREFERENCES });
  },
}));

export const PROVIDERS = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
];

/* The weights are properties of the Grading Mode, decided on the server and
   recorded on every Evidence row. They are shown, never set. */
export const EVIDENCE_RULES = [
  {
    weight: "1.00",
    title: "Graded against an Answer Key",
    body: "The Module carries a worked question and its key. The grade is authoritative.",
  },
  {
    weight: "0.70",
    title: "Graded from the course text",
    body: "No key, but the exact span that grounded the question travels with the row.",
  },
  {
    weight: "0.50",
    title: "Graded on the interviewer's own knowledge",
    body: "Anchored to a syllabus and grounded in no span. Still examinable, and the row says so.",
  },
] as const;
