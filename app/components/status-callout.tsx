import type { ReactNode } from "react";
import type { StatusMood } from "../lib/stickers";
import { StatusMascot } from "./status-mascot";

type StatusCalloutProps = {
  title: string;
  hint?: string | null;
  footer?: string | null;
  mood?: StatusMood;
  compact?: boolean;
  children?: ReactNode;
};

/**
 * Status banner with a Furina sticker — load errors, form failures, 404s.
 */
export function StatusCallout({
  title,
  hint,
  footer,
  mood = "error",
  compact = false,
  children,
}: StatusCalloutProps) {
  if (compact) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-surface/85 px-3 py-2.5 text-sm text-danger shadow-sm backdrop-blur-sm"
      >
        <StatusMascot mood={mood} size="xs" />
        <p className="min-w-0 font-medium leading-snug">{title}</p>
        {children}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="mb-4 flex items-center gap-4 rounded-2xl border border-danger/30 bg-surface/85 px-4 py-3 text-sm text-foreground shadow-sm backdrop-blur-sm sm:gap-5 sm:px-5 sm:py-4"
    >
      <StatusMascot mood={mood} size="sm" />
      <div className="min-w-0">
        <p className="font-medium text-danger">{title}</p>
        {hint ? (
          <p className="mt-1 text-foreground-muted">{hint}</p>
        ) : null}
        {footer ? (
          <p className="mt-2 text-foreground-subtle">{footer}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
