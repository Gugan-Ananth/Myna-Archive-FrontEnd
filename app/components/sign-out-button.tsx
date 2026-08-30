"use client";

import { logoutAction } from "../lib/auth/actions";
import { useI18n } from "../lib/i18n";

type SignOutButtonProps = {
  tone?: "header" | "rail";
};

export function SignOutButton({ tone = "rail" }: SignOutButtonProps) {
  const { t } = useI18n();
  const rail = tone === "rail";

  return (
    <form action={logoutAction}>
      <button
        type="submit"
        aria-label={t("signOut")}
        title={t("signOut")}
        className={
          rail
            ? [
                "inline-flex h-10 w-10 shrink-0 items-center justify-center justify-self-center rounded-full md:h-12 md:w-12",
                "bg-surface-muted text-foreground ring-1 ring-border transition-colors duration-150",
                "hover:bg-accent-soft hover:text-primary hover:ring-border-strong",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ].join(" ")
            : [
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                "border border-border bg-surface text-foreground shadow-sm",
                "transition-all duration-200 hover:border-border-strong hover:bg-accent-soft hover:text-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "focus-visible:ring-offset-background",
              ].join(" ")
        }
      >
        <SignOutIcon />
      </button>
    </form>
  );
}

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
