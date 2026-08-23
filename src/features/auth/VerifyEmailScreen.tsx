import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { verification } from "@/lib/auth/gatehouse";
import { AuthShell } from "./components/AuthShell";

type State = "working" | "done" | "failed";

/* Where Gatehouse's verification mail lands. It verifies on arrival: the
   member already acted by clicking the link, and asking them to click a second
   button is asking them to confirm that they meant the thing they just did. */
export function VerifyEmailScreen() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>(token ? "working" : "failed");

  useEffect(() => {
    if (!token) return;
    let live = true;
    verification
      .complete(token)
      .then(() => { if (live) setState("done"); })
      .catch(() => { if (live) setState("failed"); });
    return () => { live = false; };
  }, [token]);

  return (
    <AuthShell>
      <div className="auth-card">
        <div className="brand-mini">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span className="brand-name">InterviewLM</span>
        </div>

        <div>
          <p className="eyebrow">Email</p>
          <h2 className="h2 mt-2">
            {state === "working" ? "Verifying…"
              : state === "done" ? "Verified."
              : "That link did not work."}
          </h2>
          <p className="caption mt-2">
            {state === "done"
              ? "Nothing else to do here."
              : state === "failed"
                ? "It may have expired or already been used. Signing in will offer another."
                : "One moment."}
          </p>
        </div>

        <p className="caption signin-alt"><Link to="/login">Go to sign in</Link></p>
      </div>
    </AuthShell>
  );
}
