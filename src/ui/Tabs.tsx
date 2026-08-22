import { useId, useRef } from "react";
import type { ReactNode } from "react";

export interface TabItem<T extends string> {
  key: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}

/* Arrow keys move between tabs, as the pattern requires — a Candidate whose
   hands are on the keyboard mid-answer should not have to reach for a mouse
   to check the grounding span. */
export function Tabs<T extends string>({ items, value, onChange, label }: TabsProps<T>) {
  const base = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const index = items.findIndex((i) => i.key === value);
    const next = items[(index + delta + items.length) % items.length];
    onChange(next.key);
    listRef.current?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${base}-${next.key}`)}`)?.focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
      {items.map((item) => (
        <button
          key={item.key}
          id={`${base}-${item.key}`}
          type="button"
          role="tab"
          aria-selected={item.key === value}
          aria-controls={`${base}-${item.key}-panel`}
          tabIndex={item.key === value ? 0 : -1}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: boolean; children: ReactNode }) {
  return (
    <div id={id} role="tabpanel" hidden={!active}>
      {active ? children : null}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}

/* Same data, a different lens. Never used for section switching. */
export function Segmented<T extends string>({ items, value, onChange, label }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-selected={item.key === value}
          aria-pressed={item.key === value}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
