import { createContext, use } from "react";

/* Split from AppShell so the module exports a hook and a context, and the
   component module exports only components. */
export interface ShellContextValue {
  compact: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export const ShellCtx = createContext<ShellContextValue>({
  compact: false,
  drawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
});

export const useShell = () => use(ShellCtx);
