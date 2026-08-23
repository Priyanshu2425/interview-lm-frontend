import { useState } from "react";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  error?: string | null;
}

export function PasswordField({ id, label, value, onChange, autoComplete, error }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="field">
      <div className="between">
        <label className="label" htmlFor={id}>{label}</label>
      </div>
      <div className="input-pw">
        <input
          className="input"
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="Your password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <button
          className="pw-toggle"
          type="button"
          onClick={() => setShown((s) => !s)}
          /* The control's name changes with what it will do, not with what is
             showing — a screen reader reads the action, not the state. */
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
      {error ? <span className="err" id={`${id}-err`}>{error}</span> : null}
    </div>
  );
}
