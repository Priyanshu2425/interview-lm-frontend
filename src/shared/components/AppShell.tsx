import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "@/ui";
import type { IconName } from "@/ui";
import { useIsCompact, useOnEscape } from "@/shared/hooks";
import { ShellCtx } from "./shell-context";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

/* Ordered by how often a Candidate reaches for it. The examination is the
   product, so it sits at the centre of the group rather than at the end of a
   setup funnel. Credits and Settings are deliberately below the fold of
   attention: needed, never frequent. */
const PRIMARY: NavItem[] = [
  { to: "/notebook", label: "Notebook", icon: "notebook" },
  { to: "/session/new", label: "Session", icon: "scope" },
  { to: "/examination", label: "Examination", icon: "visit" },
  { to: "/mastery", label: "Mastery", icon: "mastery" },
  { to: "/evidence", label: "Evidence", icon: "ledger" },
];

const SECONDARY: NavItem[] = [
  { to: "/credits", label: "Credits", icon: "cost" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

function RailLink({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={item.end} viewTransition>
      <Icon name={item.icon} />
      {item.label}
    </NavLink>
  );
}

export function AppShell({ children, railFooter }: { children: ReactNode; railFooter?: ReactNode }) {
  const compact = useIsCompact();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  useOnEscape(drawerOpen, closeDrawer);

  /* Navigating closes the drawer, and so does growing past the breakpoint
     that turned the rail into one. Adjusted during render rather than in an
     effect: the drawer must already be shut in the frame that paints the new
     screen, not one frame later. */
  const [seen, setSeen] = useState({ pathname, compact });
  if (seen.pathname !== pathname || seen.compact !== compact) {
    setSeen({ pathname, compact });
    if (drawerOpen) setDrawerOpen(false);
  }

  const ctx = useMemo(
    () => ({ compact, drawerOpen, openDrawer, closeDrawer }),
    [compact, drawerOpen, openDrawer, closeDrawer],
  );

  const railHidden = compact && !drawerOpen;

  return (
    <ShellCtx value={ctx}>
      <div className="shell" data-drawer={drawerOpen ? "open" : undefined}>
        <a className="skip-link" href="#main">Skip to content</a>

        {drawerOpen ? <div className="drawer-backdrop" onClick={closeDrawer} aria-hidden="true" /> : null}

        <aside className="rail" id="rail" inert={railHidden || undefined}>
          <div className="between">
            <NavLink className="brand" to="/mastery" viewTransition>
              <span className="brand-mark" aria-hidden="true">I</span>
              <span className="brand-name">InterviewLM</span>
            </NavLink>
            <button className="drawer-toggle rail-close" type="button" onClick={closeDrawer} aria-label="Close menu">
              <Icon name="close" size={18} />
            </button>
          </div>

          <nav className="nav" aria-label="Primary">
            {PRIMARY.map((item) => <RailLink key={item.to} item={item} />)}
          </nav>

          <div className="grow" />

          <div className="rail-foot">
            {railFooter}
            <nav className="nav" aria-label="Account">
              {SECONDARY.map((item) => <RailLink key={item.to} item={item} />)}
            </nav>
            <div className="rail-variation hair-t">
              <span className="caption">Variation</span>
              <ThemeSwitcher />
            </div>
          </div>
        </aside>

        <div className="main" id="main">{children}</div>
      </div>
    </ShellCtx>
  );
}
