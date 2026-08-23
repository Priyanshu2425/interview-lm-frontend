import { useRouteError } from "react-router-dom";

import { ApiError } from "@/lib/api-client";

/* What a route renders when its data failed.

   React Router's own screen is a stack trace and an invitation to write this
   component. A Candidate reading it learns nothing, and the one thing worth
   saying is not in the trace: their record is on the server and this is the
   surface failing to draw it.

   Failure copy comes from the API's `code` and `message` where there is one
   (ADR-0009) — composing it here is how a message about the wrong thing
   reaches somebody. */
export function RouteError() {
  const error = useRouteError();
  const api = error instanceof ApiError ? error : null;
  const message =
    api?.message ?? (error instanceof Error ? error.message : "Something went wrong.");

  return (
    <main className="wrap canvas" style={{ maxWidth: "60ch" }}>
      <p className="eyebrow">This screen could not load</p>
      <h1 className="display-3 mt-4">Your record is fine.</h1>
      <p className="prose mt-6">
        {api?.code === "not_an_api"
          ? "This surface is not pointed at an API. It was built without VITE_API_URL, so it is asking itself for data and getting its own pages back."
          : "The surface could not read what it needed. Nothing you have done is lost — every Evidence row that was written is on the server."}
      </p>
      <p className="mono mt-6" style={{ color: "var(--muted)" }}>{message}</p>
      <p className="mt-7">
        <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </p>
    </main>
  );
}
