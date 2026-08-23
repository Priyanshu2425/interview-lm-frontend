import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthError, register } from "@/lib/auth/gatehouse";
import { AuthShell } from "./components/AuthShell";
import { PasswordField } from "./components/PasswordField";

export function RegisterScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthError | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    setBusy(true);
    try {
      await register(email.trim(), password);
      navigate("/mastery", { replace: true });
    } catch (error) {
      setFailure(
        error instanceof AuthError
          ? error
          : new AuthError(0, "Could not reach the sign-in service. Try again."),
      );
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
          <p className="eyebrow">Create an account</p>
          <h2 className="h2 mt-2">Start a record.</h2>
          <p className="caption mt-2">
            Your Evidence is filed against the account, not this browser — so it is still
            here on another device.
          </p>
        </div>

        {failure && !failure.field ? <p className="err" role="alert">{failure.message}</p> : null}

        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input
            className="input" id="email" type="email" inputMode="email"
            autoComplete="email" placeholder="you@domain.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={failure?.field === "email" ? true : undefined}
          />
          {failure?.field === "email" ? <span className="err">{failure.message}</span> : null}
        </div>

        <PasswordField
          id="password" label="Password" value={password} onChange={setPassword}
          autoComplete="new-password"
          error={failure?.field === "password" ? failure.message : null}
        />

        <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={busy}>
          <span className="btn-label">{busy ? "Creating…" : "Create account"}</span>
        </button>

        <p className="caption signin-alt">
          Already have one? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}
