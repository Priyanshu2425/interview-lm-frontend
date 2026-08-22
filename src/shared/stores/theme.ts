import { create } from "zustand";

/* Five palette variations. Adding a sixth is one block in tokens.css and one
   entry here — which is the entire cost, and the point. */
export const THEMES = [
  { key: "graphite", name: "Graphite", scene: "Examination room" },
  { key: "paper", name: "Paper", scene: "Filed record" },
  { key: "clinical", name: "Clinical", scene: "Audit surface" },
  { key: "signal", name: "Signal", scene: "Engineering" },
  { key: "dusk", name: "Dusk", scene: "Long session" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

const STORAGE_KEY = "ilm.theme.v1";
const KEYS = new Set<string>(THEMES.map((t) => t.key));

function stored(): ThemeKey {
  if (typeof document === "undefined") return "graphite";
  /* index.html has already stamped the element before first paint. Reading it
     back is cheaper than a second storage hit and cannot disagree with what
     the user is looking at. */
  const painted = document.documentElement.getAttribute("data-theme");
  return painted && KEYS.has(painted) ? (painted as ThemeKey) : "graphite";
}

interface ThemeState {
  theme: ThemeKey;
  setTheme: (theme: ThemeKey) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: stored(),
  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private mode: the choice holds for this tab and no further */
    }
    set({ theme });
  },
}));
