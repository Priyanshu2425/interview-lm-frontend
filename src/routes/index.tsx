import { lazy } from "react";
import { Navigate, createBrowserRouter, useParams } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import { MasteryScreen } from "@/features/mastery";
import { SessionSetupScreen } from "@/features/session-setup";
import { SessionsScreen } from "@/features/sessions";
import { ExaminationScreen } from "@/features/examination";
import { ReportScreen } from "@/features/report";
import { RequireOnboarding, WelcomeScreen } from "@/features/onboarding";
import { NotebookLibraryScreen, NotebookWorkbenchScreen } from "@/features/notebook";
import { NotFoundScreen } from "./NotFoundScreen";
import { RouteError } from "./RouteError";
import {
  ForgotPasswordScreen, LoginScreen, RegisterScreen, RequireSession,
  ResetPasswordScreen, VerifyEmailScreen,
} from "@/features/auth";

/* Credits, Settings and the Operator console are reached deliberately and
   rarely. They are split out so the examination route — the one that matters
   under time pressure — does not carry their weight. */
const CreditsScreen = lazy(() =>
  import("@/features/credits").then((m) => ({ default: m.CreditsScreen })),
);
const SettingsScreen = lazy(() =>
  import("@/features/settings").then((m) => ({ default: m.SettingsScreen })),
);
const OperatorScreen = lazy(() =>
  import("@/features/operator").then((m) => ({ default: m.OperatorScreen })),
);
const SkillsAdminScreen = lazy(() =>
  import("@/features/skills-admin").then((m) => ({ default: m.SkillsAdminScreen })),
);

function RedirectToReport() {
  const { sessionId } = useParams();
  return <Navigate to={`/report/${sessionId}`} replace />;
}

export const router = createBrowserRouter([
  /* Outside the session, and outside the shell: somebody who is not signed in
     has no record to put a navigation bar around. `/reset-password` and
     `/verify-email` are here because Gatehouse mails links to them — they are
     addresses on this domain whether or not anything answers. */
  { path: "/login", element: <LoginScreen /> },
  { path: "/register", element: <RegisterScreen /> },
  { path: "/forgot-password", element: <ForgotPasswordScreen /> },
  { path: "/reset-password", element: <ResetPasswordScreen /> },
  { path: "/verify-email", element: <VerifyEmailScreen /> },
  {
    element: <RequireSession />,
    /* Signed in, but not yet asked who they are. The form sits inside the
       session gate because the question needs a token to ask, and outside
       `RootLayout` because a nav rail around a first-run form invites
       somebody to leave it half-answered. */
    children: [{
      element: <RequireOnboarding />,
      children: [
    { path: "/welcome", element: <WelcomeScreen /> },
    {
    path: "/",
    element: <RootLayout />,
    /* Every screen behind the session shares one. A route without an
       errorElement shows React Router's developer screen to a Candidate. */
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/mastery" replace /> },
      { path: "mastery", element: <MasteryScreen /> },
      { path: "notebook", element: <NotebookLibraryScreen /> },
      /* Two siblings rather than a parent with an Outlet: the Library and one
         open notebook share no chrome, and a layout route whose only job is to
         pick one of two disjoint screens is indirection with nothing in it. */
      { path: "notebook/:notebookId", element: <NotebookWorkbenchScreen /> },
      /* The Sessions you have sat, and the way to sit another. This was
         `/examination`, which could only be reached by already being in one —
         a tab whose entire content was an empty state telling you to go
         elsewhere. */
      { path: "session", element: <SessionsScreen /> },
      { path: "session/new", element: <SessionSetupScreen /> },
      { path: "examination/:sessionId", element: <ExaminationScreen /> },
      { path: "examination", element: <Navigate to="/session" replace /> },
      { path: "report/:sessionId", element: <ReportScreen /> },
      /* A report belongs to one Session and is opened from its row. The
         standalone picker read the browser's own history, which held five
         entries and only from the browser that ran them. */
      { path: "report", element: <Navigate to="/session" replace /> },
      /* The record screen was `/evidence` until the Session stopped being a
         sequence of graded Visits. Links to it are in people's history and in
         Sessions already ended, so the old address keeps answering. */
      { path: "evidence", element: <Navigate to="/session" replace /> },
      { path: "evidence/:sessionId", element: <RedirectToReport /> },
      { path: "credits", element: <CreditsScreen /> },
      { path: "settings", element: <SettingsScreen /> },
      { path: "*", element: <NotFoundScreen /> },
    ],
    },
      ],
    }],
  },
  /* Operator and Skills are a team-only console gated by the `OPERATOR_TOKEN`
     shared secret, a credential unrelated to a Candidate's Gatehouse session.
     Nested under `RequireSession` (or `RootLayout`, which assumes a running
     Session for its rail) they would need a Candidate login just to reach
     their own operator-token gate — friction with no security benefit, since
     the operator token is the actual gate either way. */
  { path: "/operator", element: <OperatorScreen />, errorElement: <RouteError /> },
  { path: "/skills-admin", element: <SkillsAdminScreen />, errorElement: <RouteError /> },
]);
