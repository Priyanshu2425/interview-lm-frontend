import { useState } from "react";
import { Link } from "react-router-dom";

import { passwordReset } from "@/lib/auth/gatehouse";
import { AuthShell } from "./components/AuthShell";

export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await passwordReset.request(email.trim());
    } catch {
      /* Deliberately ignored. The endpoint answers 202 whether or not the
         address is known, and behaving differently here would turn this form
         into a way to ask which addresses have accounts. */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <AuthShell>
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="brand-mini">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span className="brand-name">InterviewLM</span>
        </div>

        {sent ? (
          <div>
            <p className="eyebrow">Check your mail</p>
            <h2 className="h2 mt-2">If that address has an account, a link is on its way.</h2>
            <p className="caption mt-2">
              The link expires shortly. You can close this page.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="eyebrow">Reset password</p>
              <h2 className="h2 mt-2">We will mail you a link.</h2>
            </div>
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input
                className="input" id="email" type="email" inputMode="email"
                autoComplete="email" placeholder="you@domain.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={busy}>
              <span className="btn-label">{busy ? "Sending…" : "Send the link"}</span>
            </button>
          </>
        )}

        <p className="caption signin-alt"><Link to="/login">Back to sign in</Link></p>
      </form>
    </AuthShell>
  );
}
