import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AuthError, signIn } from "@/lib/auth/gatehouse";
import { AuthShell } from "./components/AuthShell";
import { PasswordField } from "./components/PasswordField";

/* Google is built and hidden. The markup is here so turning it on is a flag
   rather than a redesign, and it is off because the tenant has no provider
   registered — a button that starts a handshake nothing can finish is worse
   than no button. */
const GOOGLE_ENABLED = false;

export function LoginScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthError | null>(null);

  const fieldError = (name: string) =>
    failure?.field === name ? failure.message : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(params.get("next") ?? "/mastery", { replace: true });
    } catch (error) {
      /* Rendered from what the server said. Composing the copy here is how a
         message about the wrong thing reaches somebody (ADR-0009). */
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
          <p className="eyebrow">Sign in</p>
          <h2 className="h2 mt-2">Welcome back.</h2>
          <p className="caption mt-2">Use your email and password.</p>
        </div>

        {failure && !failure.field ? (
          <p className="err" role="alert">{failure.message}</p>
        ) : null}

        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input
            className="input"
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={fieldError("email") ? true : undefined}
            aria-describedby={fieldError("email") ? "email-err" : undefined}
          />
          {fieldError("email") ? <span className="err" id="email-err">{fieldError("email")}</span> : null}
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={fieldError("password")}
        />

        <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={busy}>
          <span className="btn-label">{busy ? "Signing in…" : "Sign in"}</span>
        </button>

        {GOOGLE_ENABLED ? (
          <>
            <div className="auth-divider"><span>or continue with</span></div>
            <button className="btn btn-secondary btn-lg btn-full" type="button">
              <svg className="g-mark" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.051-3.711H1.06v2.331C2.536 16.231 5.527 18 9 18z" />
                <path fill="#FBBC05" d="M3.949 10.706c-.18-.54-.283-1.115-.283-1.706s.103-1.166.283-1.706V4.963H1.06A8.997 8.997 0 0 0 0 9c0 1.452.347 2.827.96 4.037l2.989-2.331z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.527 0 2.536 1.769 1.06 4.963l2.989 2.331C4.672 5.164 6.656 3.58 9 3.58z" />
              </svg>
              <span className="btn-label">Continue with Google</span>
            </button>
          </>
        ) : null}

        <p className="caption signin-alt">
          <Link to="/forgot-password">Forgot your password?</Link>
          {" · "}
          <Link to="/register">Create an account</Link>
        </p>
      </form>
    </AuthShell>
  );
}
