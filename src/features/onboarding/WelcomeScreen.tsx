import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { Button, Choice, TextAreaField, TextField } from "@/ui";
import { useOnboard } from "./hooks/useProfile";

/* The first thing this product ever asks a person about themselves.
 *
 * It is deliberately small. ADR-0026 keeps the credential and the address at
 * Gatehouse — there is no email field here and there will not be one, because
 * a copy of one goes stale the moment it is changed upstream.
 *
 * Nothing reads the last three answers yet. The form exists because this is
 * the only moment somebody will answer, and the copy says what is true —
 * that the answers are kept — rather than promising a calibration that has
 * not been built. */

const LEVELS = [
  { value: "student", title: "Studying", sub: "At university, a bootcamp, or teaching myself" },
  { value: "early", title: "Early career", sub: "Shipping professionally, under about three years" },
  { value: "experienced", title: "Experienced", sub: "Several years in, interviewing for a step up" },
] as const;

export function WelcomeScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const onboard = useOnboard();

  const [displayName, setDisplayName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");

  const next = params.get("next") || "/mastery";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onboard.mutate(
      {
        display_name: displayName,
        target_role: targetRole,
        experience_level: level,
        goal,
      },
      { onSuccess: () => navigate(next, { replace: true }) },
    );
  };

  return (
    <AuthShell>
      <form className="auth-card stack g-7" onSubmit={submit} noValidate>
        <div>
          <p className="eyebrow">First time here</p>
          <h1 className="h1 mt-4">What should we call you?</h1>
          <p className="prose mt-5">
            Four questions, asked once. Only the first is used anywhere yet — the rest are
            kept with your record because this is the moment to ask, not because something
            is waiting to read them.
          </p>
        </div>

        {/* The API's own sentence, as everywhere else on the surface. */}
        {onboard.error ? (
          <p className="err" role="alert">{(onboard.error as Error).message}</p>
        ) : null}

        <TextField
          label="Display name"
          hint="Shown to you, in this browser. Nobody is ranked by it."
          value={displayName}
          onChange={(e) => setDisplayName(e.currentTarget.value)}
          autoFocus
        />

        <TextField
          label="What are you preparing for?"
          hint="A role, a company, an exam — whatever you are aiming at. Optional."
          value={targetRole}
          onChange={(e) => setTargetRole(e.currentTarget.value)}
        />

        <fieldset className="stack g-4" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Where you are</legend>
          {LEVELS.map((l) => (
            <Choice
              key={l.value}
              name="experience_level"
              value={l.value}
              checked={level === l.value}
              onChange={setLevel}
              title={l.title}
              sub={l.sub}
            />
          ))}
        </fieldset>

        <TextAreaField
          label="Anything you want to say about it"
          hint="Optional, and free text. It is kept with your record."
          rows={3}
          value={goal}
          onChange={(e) => setGoal(e.currentTarget.value)}
        />

        <div className="row g-5" style={{ flexWrap: "wrap" }}>
          <Button type="submit" variant="primary" loading={onboard.isPending} loadingLabel="Saving…">
            Continue
          </Button>
          <span className="caption">
            Answer what you like — an empty field is left blank rather than guessed at.
          </span>
        </div>
      </form>
    </AuthShell>
  );
}
