import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/shared/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

interface Shared {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  icon?: boolean;
  className?: string;
  children?: ReactNode;
}

const classesFor = ({ variant = "secondary", size = "md", full, icon, className }: Shared) =>
  cn(
    "btn",
    `btn-${variant}`,
    size !== "md" && `btn-${size}`,
    full && "btn-full",
    icon && "btn-icon",
    className,
  );

interface ButtonProps extends Shared, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  loading?: boolean;
  loadingLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant, size, full, icon, className, loading, loadingLabel, children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={classesFor({ variant, size, full, icon, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}

interface ButtonLinkProps extends Shared {
  to: string;
  /* An `aria-disabled` link is still focusable and still announces itself, but
     it does not navigate — which is what a control that is not yet available
     should do, rather than vanishing. */
  disabled?: boolean;
  title?: string;
  viewTransition?: boolean;
}

export function ButtonLink({ to, disabled, children, viewTransition = true, ...rest }: ButtonLinkProps) {
  if (disabled) {
    return (
      <span className={classesFor(rest)} aria-disabled="true" role="link" tabIndex={0} title={rest.title}>
        {children}
      </span>
    );
  }
  return (
    <Link to={to} className={classesFor(rest)} viewTransition={viewTransition} title={rest.title}>
      {children}
    </Link>
  );
}
