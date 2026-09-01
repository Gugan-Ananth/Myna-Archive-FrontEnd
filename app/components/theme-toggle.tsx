"use client";

import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { AppIcon } from "./app-icon";

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
      <AppIcon
        src="/icons/themes.png"
        className="h-[1.125rem] w-[1.125rem] md:h-[1.25rem] md:w-[1.25rem]"
      />
    </button>
  );
}
