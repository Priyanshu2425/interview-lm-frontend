import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface State { error: Error | null }

/* The last line before a white screen. A Candidate mid-Session should be told
   what happened and offered the route back into their own record, not left
   looking at nothing. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Surface crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="wrap canvas" style={{ maxWidth: "60ch" }}>
        <p className="eyebrow">Something broke on this screen</p>
        <h1 className="display-3 mt-4">Your record is fine.</h1>
        <p className="prose mt-6">
          The surface failed to render, not the Session behind it. Every Evidence row that was written is on
          the server, and reloading picks up where you were.
        </p>
        <p className="mono mt-6" style={{ color: "var(--muted)" }}>{this.state.error.message}</p>
        <div className="row g-4 mt-8">
          <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
            Reload the surface
          </button>
          <a className="btn btn-ghost" href="/mastery">Go to the Mastery map</a>
        </div>
      </main>
    );
  }
}
