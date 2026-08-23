import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useRestored, useSignedIn } from "@/shared/stores/session";

/* Everything behind this needs a session.

   A reload loses the access token, because it was only ever in memory — but
   the refresh cookie survives it. `main.tsx` spends it once before the tree
   renders; this waits for that answer. "Not signed in" is not knowable until
   it lands, and redirecting sooner signs people out on every reload.

   The refresh happens there rather than here on purpose: mounted per route, it
   would spend a second refresh token, and Gatehouse reads a reused one as
   theft and revokes the whole chain.

   `next` is carried so the redirect lands where they were going rather than on
   the front page. */
export function RequireSession() {
  const signedIn = useSignedIn();
  const restored = useRestored();
  const location = useLocation();

  if (!restored) {
    return (
      <div className="auth-form" aria-busy="true">
        <p className="caption">One moment.</p>
      </div>
    );
  }
  if (!signedIn) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
