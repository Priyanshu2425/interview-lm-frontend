import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useProfile } from "./hooks/useProfile";

/* The second gate (ISSUE-0048).
 *
 * `RequireSession` answers "is anybody signed in". This answers "have they
 * ever told us who they are" — and it sits inside that one, because the
 * question only has an answer once a token exists to ask it with.
 *
 * Three rules, each of which is the difference between a gate and a trap:
 *
 *  - While the read is in flight, wait. Redirecting on *unknown* would push
 *    somebody through the form on every reload, which is the same mistake
 *    `RequireSession` avoids by waiting for `restored`.
 *  - If the read fails, let them through. An onboarding form is not a
 *    security gate, and a 500 on `/candidates/me` must not lock a Candidate
 *    out of a Session they are in the middle of.
 *  - Once onboarded, `/welcome` is not somewhere to be. */
export function RequireOnboarding() {
  const profile = useProfile();
  const location = useLocation();
  const atForm = location.pathname === "/welcome";

  if (profile.isPending) {
    return (
      <div className="auth-form" aria-busy="true">
        <p className="caption">One moment.</p>
      </div>
    );
  }

  /* Unreadable is not the same as unanswered, and it is not this gate's
     business either way. */
  if (profile.isError) return <Outlet />;

  if (!profile.data?.onboarded && !atForm) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />;
  }

  if (profile.data?.onboarded && atForm) {
    return <Navigate to="/mastery" replace />;
  }

  return <Outlet />;
}
