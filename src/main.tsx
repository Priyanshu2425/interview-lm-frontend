import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import "@/ui/styles/tokens.css";
import "@/ui/styles/system.css";
import "@/ui/styles/patterns.css";
import "@/ui/styles/shell.css";

import { createQueryClient } from "@/lib/query-client";
import { router } from "@/routes";
import { ErrorBoundary } from "@/routes/ErrorBoundary";
import { ToastHost } from "@/ui";

/* One client per app load, created outside render so a re-render never throws
   the cache away. */
const queryClient = createQueryClient();

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
