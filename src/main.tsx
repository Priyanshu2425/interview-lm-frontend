import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import "@/ui/styles/tokens.css";
import "@/ui/styles/system.css";
import "@/ui/styles/auth.css";
import "@/ui/styles/patterns.css";
import "@/ui/styles/shell.css";

import { restore } from "@/lib/auth/gatehouse";
import { createQueryClient } from "@/lib/query-client";
import { router } from "@/routes";
import { ErrorBoundary } from "@/routes/ErrorBoundary";
import { ToastHost } from "@/ui";

/* One client per app load, created outside render so a re-render never throws
   the cache away. */
const queryClient = createQueryClient();

/* Spend the refresh cookie once, here, before anything renders.

   A reload loses the access token — it lives in memory and nowhere a script
   can read it — so this is what makes a member who signed in yesterday signed
   in now. Not awaited: the tree renders immediately and `RequireSession` shows
   a waiting state until the answer lands, which is a moment of "one moment"
   rather than a blank page.

   Once, at the root, and never per route: refresh tokens rotate, and
   presenting a consumed one is treated as theft — it revokes the whole chain
   and signs the member out everywhere. */
void restore();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <ToastHost />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
