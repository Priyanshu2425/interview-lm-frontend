import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils/cn";
import { useToastStore } from "@/shared/stores/toasts";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export function Skeleton({ width = "100%", height = 14, className }: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return <div className={cn("skeleton", className)} style={{ width, height }} aria-hidden="true" />;
}

/* A loading surface should have the shape of the thing arriving, so the layout
   does not jump when it does. */
export function SkeletonLines({ count = 3, label }: { count?: number; label: string }) {
  const widths = ["70%", "92%", "54%", "84%", "62%"];
  return (
    <div className="stack g-5" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} />
      ))}
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

interface EmptyProps {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}

/* Dashed, matching the Evidence Floor treatment on purpose: "nothing here
   yet" and "not enough evidence yet" are the same kind of fact. */
export function EmptyState({ icon = "evidence", title, body, action }: EmptyProps) {
  return (
    <div className="empty">
      <Icon name={icon} size={22} />
      <span className="body-sm">{title}</span>
      {body ? <span className="caption">{body}</span> : null}
      {action ? <span className="mt-4">{action}</span> : null}
    </div>
  );
}

interface ErrorProps {
  title: string;
  /* Rendered from the API's own message. The surface composes no billing copy,
     which is what keeps a Credit message from reaching a BYOK Candidate. */
  message: string;
  action?: ReactNode;
}

export function ErrorState({ title, message, action }: ErrorProps) {
  return (
    <div className="panel pad-7 stack g-5" role="alert">
      <div className="row g-4">
        <Icon name="info" size={18} style={{ color: "var(--risk)" }} />
        <strong className="h4">{title}</strong>
      </div>
      <p className="body-sm dim" style={{ margin: 0 }}>{message}</p>
      {action ? <div className="row g-4">{action}</div> : null}
    </div>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  const fraction = Math.min(1, Math.max(0, value));
  const pct = Math.round(fraction * 100);
  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <i style={{ transform: `scaleX(${fraction})` }} />
    </div>
  );
}

export function Thinking({ label }: { label: string }) {
  return (
    <div className="thinking" role="status" aria-label={label}>
      <span /><span /><span />
    </div>
  );
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="toast-host" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => dismiss(t.id)}>
          <span className={cn("toast-bar", t.tone === "ok" && "toast-bar-ok", t.tone === "risk" && "toast-bar-risk")} />
          <span>
            <strong className="body-sm">{t.title}</strong>
            {t.body ? <><br /><span className="caption">{t.body}</span></> : null}
          </span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
