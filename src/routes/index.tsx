import { lazy } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { RootLayout } from "./layouts/RootLayout";
import { MasteryScreen } from "@/features/mastery";
import { SessionSetupScreen } from "@/features/session-setup";
import { ExaminationScreen } from "@/features/examination";
import { EvidenceScreen } from "@/features/evidence";
import { NotebookScreen } from "@/features/notebook";
import { NotFoundScreen } from "./NotFoundScreen";

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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/mastery" replace /> },
      { path: "mastery", element: <MasteryScreen /> },
      { path: "notebook", element: <NotebookScreen /> },
      { path: "session/new", element: <SessionSetupScreen /> },
      { path: "session", element: <Navigate to="/session/new" replace /> },
      { path: "examination", element: <ExaminationScreen /> },
      { path: "examination/:sessionId", element: <ExaminationScreen /> },
      { path: "evidence", element: <EvidenceScreen /> },
      { path: "evidence/:sessionId", element: <EvidenceScreen /> },
      { path: "credits", element: <CreditsScreen /> },
      { path: "settings", element: <SettingsScreen /> },
      { path: "operator", element: <OperatorScreen /> },
      { path: "*", element: <NotFoundScreen /> },
    ],
  },
]);
