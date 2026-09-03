import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/utils/cn";
import { Icon } from "./Icon";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string, invalid: boolean) => ReactNode;
  /* The mirrored value a slider or a budget control shows beside its label. */
  aside?: ReactNode;
  className?: string;
}

/* Label, control, and the one place a hint or an error is allowed to sit.
   The error replaces the hint rather than stacking under it, so the row never
   changes height when validation fires. */
export function Field({ label, hint, error, children, aside, className }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("field", className)}>
      {aside ? (
        <div className="between">
          <label className="label" htmlFor={id}>{label}</label>
          {aside}
        </div>
      ) : (
        <label className="label" htmlFor={id}>{label}</label>
      )}
      {children(id, Boolean(error))}
      {error ? (
        <span className="err" id={`${id}-err`} role="alert">{error}</span>
      ) : hint ? (
        <span className="hint" id={`${id}-hint`}>{hint}</span>
      ) : null}
      <span hidden data-describedby={describedBy} />
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  hint?: ReactNode;
  error?: string;
  mono?: boolean;
  search?: boolean;
}

export function TextField({ label, hint, error, mono, search, ...rest }: TextFieldProps) {
  const body = (id: string, invalid: boolean) => (
    <input
      id={id}
      className={cn("input", mono && "input-mono")}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-err` : hint ? `${id}-hint` : undefined}
      {...rest}
    />
  );
  if (!search) return <Field label={label} hint={hint} error={error}>{body}</Field>;
  return (
    <Field label={label} hint={hint} error={error} className="search">
      {(id, invalid) => (
        <>
          <Icon name="search" />
          {body(id, invalid)}
        </>
      )}
    </Field>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextAreaField({ label, hint, error, ...rest }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, invalid) => (
        <textarea
          id={id}
          className="textarea"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : hint ? `${id}-hint` : undefined}
          {...rest}
        />
      )}
    </Field>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> {
  label: string;
  hint?: ReactNode;
  options: { value: string; label: string }[];
}

export function SelectField({ label, hint, options, ...rest }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} className="select" aria-describedby={hint ? `${id}-hint` : undefined} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </Field>
  );
}

interface SliderFieldProps {
  label: string;
  hint?: ReactNode;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  /* The value is always mirrored in mono beside the label, never left to the
     thumb position alone. */
  format: (value: number) => string;
}

export function SliderField({ label, hint, min, max, value, onChange, format }: SliderFieldProps) {
  return (
    <Field label={label} hint={hint} aside={<span className="mono">{format(value)}</span>}>
      {(id) => (
        <input
          id={id}
          type="range"
          className="slider"
          min={min}
          max={max}
          value={value}
          aria-valuetext={format(value)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}
    </Field>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}

interface CheckboxProps extends ToggleProps {
  /* Some but not all. A "select all" that reads as empty while three things
     are selected is telling the truth about itself and lying about the list. */
  indeterminate?: boolean;
}

export function Switch({ checked, onChange, children, disabled }: ToggleProps) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}

export function Checkbox({ checked, onChange, children, disabled, indeterminate }: CheckboxProps) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        /* The DOM property, not an attribute — it is the only way to set it,
           and aria-checked carries the same fact to assistive technology. */
        ref={(node) => { if (node) node.indeterminate = Boolean(indeterminate) && !checked; }}
        aria-checked={indeterminate && !checked ? "mixed" : checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="check-box" data-mixed={indeterminate && !checked ? "" : undefined} aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}

interface ChoiceProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  sub: string;
  /* An option the server would refuse. It stays on the card rather than
     disappearing, because a choice that vanishes reads as one that never
     existed — and `sub` is where the reason goes. */
  disabled?: boolean;
}

export function Choice({ name, value, checked, onChange, title, sub, disabled }: ChoiceProps) {
  return (
    <label className="choice" data-disabled={disabled ? "" : undefined}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
      />
      <span className="choice-title">{title}</span>
      <span className="choice-sub">{sub}</span>
    </label>
  );
}
