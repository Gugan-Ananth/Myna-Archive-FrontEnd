"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LOCALE_META, LOCALES, useI18n, type Locale } from "../lib/i18n";

type LanguageSwitcherProps = {
  /** Where the menu opens from the trigger. */
  menu?: "down" | "rail" | "up";
  tone?: "header" | "rail";
};

/**
 * Compact language control. Globe mark + menu: Español / English / Català.
 */
export function LanguageSwitcher({
  menu = "down",
  tone = "header",
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: Locale) {
    setLocale(next);
    setOpen(false);
  }

  return (
    <div className="relative justify-self-center" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("chooseLanguage")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        title={t("language")}
        className={
          tone === "rail"
            ? [
                "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full md:h-12 md:w-12",
                "bg-surface-muted text-foreground ring-1 ring-border transition-colors duration-150",
                "hover:bg-accent-soft hover:text-primary hover:ring-border-strong",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                open ? "bg-accent-soft text-primary ring-border-strong" : "",
              ].join(" ")
            : [
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                "border border-border bg-surface text-foreground shadow-sm",
                "transition-all duration-200 hover:border-border-strong hover:bg-accent-soft hover:text-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                open ? "border-primary bg-accent-soft text-primary" : "",
              ].join(" ")
        }
      >
        <GlobeIcon className="h-5 w-5 md:h-6 md:w-6" />
        <span className="sr-only">
          {LOCALE_META[locale].nativeLabel}
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label={t("language")}
          className={[
            "absolute z-50 min-w-[11.5rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border bg-surface py-1.5 shadow-[0_12px_40px_-12px_rgba(30,27,46,0.28)]",
            "animate-[search-panel-in_140ms_ease-out]",
            menu === "rail"
              ? "bottom-0 left-[calc(100%+0.5rem)] origin-bottom-left"
              : menu === "up"
                ? "right-0 bottom-[calc(100%+0.4rem)] origin-bottom-right"
                : "right-0 top-[calc(100%+0.4rem)] origin-top-right",
          ].join(" ")}
        >
          {LOCALES.map((code) => {
            const meta = LOCALE_META[code];
            const selected = code === locale;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(code)}
                className={[
                  "flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm transition-colors",
                  selected
                    ? "bg-accent-soft font-semibold text-primary"
                    : "font-medium text-foreground hover:bg-surface-muted",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-wide ring-1",
                    selected
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-surface-muted text-foreground-muted ring-border",
                  ].join(" ")}
                >
                  {meta.short}
                </span>
                <span className="flex-1">{meta.nativeLabel}</span>
                {selected && (
                  <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GlobeIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12.5 9.5 17 19 7.5" />
    </svg>
  );
}
