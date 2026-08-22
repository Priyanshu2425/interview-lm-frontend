import { THEMES, useThemeStore } from "@/shared/stores/theme";
import type { ThemeKey } from "@/shared/stores/theme";

/* Five swatches, each labelled. The active one is carried by aria-pressed as
   well as by the ring, so the choice is legible without colour. */
export function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div className="row g-3" role="group" aria-label="Colour variation">
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          className="theme-dot"
          data-theme={t.key}
          aria-pressed={t.key === theme}
          aria-label={`${t.name} — ${t.scene}`}
          title={`${t.name} · ${t.scene}`}
          onClick={() => setTheme(t.key as ThemeKey)}
        >
          <span aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
