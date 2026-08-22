import type { ReactNode } from "react";
import { Icon } from "@/ui";
import { useShell } from "./shell-context";

interface PageHeaderProps {
  /* The eyebrow above the title, where a screen has a position in a sequence
     worth naming — "Topic Visit 4", not decoration. */
  eyebrow?: string;
  title: string;
  sub?: string;
  children?: ReactNode;
}

/* One topbar, every screen. On a phone the rail's hamburger lives here, which
   is where the mobile designs put it. */
export function PageHeader({ eyebrow, title, sub, children }: PageHeaderProps) {
  const { compact, openDrawer, drawerOpen } = useShell();
  return (
    <header className="topbar">
      {compact ? (
        <button
          className="drawer-toggle"
          type="button"
          onClick={openDrawer}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="rail"
        >
          <Icon name="menu" size={20} />
        </button>
      ) : null}

      <div className="topbar-title">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <strong>{title}</strong>
      </div>
      {sub ? <span className="caption">{sub}</span> : null}
      <span className="grow" />
      {children}
    </header>
  );
}
