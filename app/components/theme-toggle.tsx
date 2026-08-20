"use client";

import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";

type ThemeToggleProps = {
  /** Match the left rail / dock icon buttons. */
  tone?: "header" | "rail";
};

/**
 * Compact light/dark control. Shows moon in light mode, sun in dark mode.
 */
export function ThemeToggle({ tone = "header" }: ThemeToggleProps) {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const rail = tone === "rail";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t("switchToLightMode") : t("switchToDarkMode")}
      title={isDark ? t("lightMode") : t("darkMode")}
      aria-pressed={isDark}
      className={
        rail
          ? [
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              "text-foreground-muted transition-colors duration-150",
              "hover:bg-accent-soft hover:text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            ].join(" ")
          : [
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              "border border-border bg-surface text-foreground shadow-sm",
              "transition-all duration-200 hover:border-border-strong hover:bg-accent-soft hover:text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "focus-visible:ring-offset-background",
            ].join(" ")
      }
    >
      {isDark ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <MoonIcon className="h-5 w-5" />
      )}
    </button>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
    </svg>
  );
}
