import { useEffect, useState } from "react";

export interface SettingsSection {
  id: string;
  label: string;
  hint: string;
}

/* Grouped by domain, and the group you are reading is the one highlighted —
   so a long configuration page never loses the reader's place. */
export function SettingsNav({ sections }: { sections: readonly SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-84px 0px -60% 0px", threshold: 0 },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} aria-current={s.id === active ? "true" : undefined}>
          <span>{s.label}</span>
          <span className="caption">{s.hint}</span>
        </a>
      ))}
    </nav>
  );
}
