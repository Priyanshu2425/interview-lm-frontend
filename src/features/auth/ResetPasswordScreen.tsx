import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AuthError, passwordReset } from "@/lib/auth/gatehouse";
import { AuthShell } from "./components/AuthShell";
import { PasswordField } from "./components/PasswordField";

/* Where Gatehouse's reset mail lands. The token is in the query string because
   that is where the mail puts it — this route exists so the link works. */
export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    setBusy(true);
    try {
      await passwordReset.complete(token, password);
      navigate("/login", { replace: true });
    } catch (error) {
      setFailure(error instanceof AuthError ? error.message : "That link did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="brand-mini">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span className="brand-name">InterviewLM</span>
        </div>

        <div>
          <p className="eyebrow">Reset password</p>
          <h2 className="h2 mt-2">Choose a new one.</h2>
        </div>

        {!token ? (
          <p className="err" role="alert">
            This link is missing its token. Open the link from the mail, or ask for a new one.
          </p>
        ) : null}
        {failure ? <p className="err" role="alert">{failure}</p> : null}

        <PasswordField
          id="password" label="New password" value={password} onChange={setPassword}
          autoComplete="new-password"
        />

        <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={busy || !token}>
          <span className="btn-label">{busy ? "Saving…" : "Save and sign in"}</span>
        </button>

        <p className="caption signin-alt"><Link to="/forgot-password">Ask for a new link</Link></p>
      </form>
    </AuthShell>
  );
}
