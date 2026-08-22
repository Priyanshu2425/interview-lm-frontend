import type { SVGProps } from "react";

/* 16px grid · 1.6 stroke · currentColor · no fills · never emoji.
   Paths are hoisted module-level so a re-render never re-allocates them. */

const PATHS = {
  visit: <path d="M2.5 4.5h11v7h-6l-3 2.5v-2.5h-2z" />,
  evidence: <><path d="M4 2.5h8v11H4z" /><path d="M6 5.5h4M6 8h4M6 10.5h2.5" /></>,
  judge: <><path d="M8 2.5v11M4 6.5h8" /><circle cx="8" cy="4.2" r="1.2" /></>,
  source: <><path d="M5.5 2.5h5l3 3v8h-8z" /><path d="M10.5 2.5v3h3" /></>,
  cost: <><circle cx="8" cy="8" r="5.5" /><path d="M8 5v6M6.4 6.4h3.2M6.4 9.6h3.2" /></>,
  scope: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2" /></>,
  timer: <><circle cx="8" cy="8.6" r="5" /><path d="M8 6v2.6l1.8 1.2M6.4 2.4h3.2" /></>,
  resume: <><path d="M3 8a5 5 0 1 1 1.6 3.6" /><path d="M3 5.4V8.4h3" /></>,
  hint: <><path d="M8 2.6a3.6 3.6 0 0 1 2.2 6.4c-.5.5-.7 1-.7 1.6h-3c0-.6-.2-1.1-.7-1.6A3.6 3.6 0 0 1 8 2.6Z" /><path d="M6.8 13h2.4" /></>,
  floor: <><path d="M2.5 11h11" /><path d="M4.5 8h2M8 8h2M11.5 8h1" /></>,
  probe: <path d="M2.5 8h4l2-4 2 8 1.5-4h1.5" />,
  module: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  notebook: <><path d="M4 2.5h8v11H4z" /><path d="M6 5.5h4M6 8h4" /></>,
  mastery: <path d="M2.5 12.5h11M3.5 12.5V7M6.8 12.5V4M10.1 12.5V9M13.4 12.5V5.5" />,
  ledger: <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />,
  settings: <><circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1M12.4 12.4l-1.1-1.1M4.7 4.7 3.6 3.6" /></>,
  operator: <><path d="M2.5 3.5h11v4h-11zM2.5 9h11v3.5h-11z" /><path d="M4.5 5.5h.01M4.5 10.7h.01" /></>,
  search: <><circle cx="7" cy="7" r="4.2" /><path d="M10.2 10.2 13.5 13.5" /></>,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  left: <path d="M13 8H3M7 4 3 8l4 4" />,
  right: <path d="M3 8h10M9 4l4 4-4 4" />,
  chevron: <path d="M6 3l5 5-5 5" />,
  check: <path d="M3 8.4 6.4 11.6 13 4.8" />,
  blind: <><path d="M1.6 8S4 4 8 4s6.4 4 6.4 4-2.4 4-6.4 4S1.6 8 1.6 8Z" /><path d="M2.5 13.5 13.5 2.5" /></>,
  upload: <><path d="M8 11V3.4M5.4 6 8 3.4 10.6 6" /><path d="M2.8 11v1.8h10.4V11" /></>,
  info: <><circle cx="8" cy="8" r="6" /><path d="M8 5.4v3.2M8 11h.01" /></>,
  trash: <><path d="M3.5 4.5h9M6.5 4.5v-2h3v2M5 4.5l.6 9h4.8l.6-9" /></>,
  key: <><circle cx="5.4" cy="8" r="2.6" /><path d="M8 8h5.5M11.5 8v2.2M13.5 8v1.6" /></>,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
