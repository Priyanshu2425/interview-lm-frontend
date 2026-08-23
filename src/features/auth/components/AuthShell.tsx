import type { ReactNode } from "react";

/* The two-column sign-in frame from the design files.

   The left column is the product saying what it is; it is hidden below 900px,
   where the form takes the whole screen. The right column is whichever of the
   sign-in screens is showing. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">I</span>
          <span className="brand-name">InterviewLM</span>
        </a>

        <div className="auth-motif">
          <p className="caption">
            Mastery is the mean. Coverage is the evidence. Untested is not zero.
          </p>
        </div>

        <div>
          <h1 className="display-2">A system for saying what you actually know.</h1>
          <p className="prose mt-5">
            InterviewLM examines you on material you have read and keeps an honest record of
            what you could explain — the interface has one job: never let the record claim
            more than the evidence supports.
          </p>
        </div>

        <div className="auth-foot">
          <span className="caption">© InterviewLM</span>
        </div>
      </aside>

      <main className="auth-form">{children}</main>
    </div>
  );
}
