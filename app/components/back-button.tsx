"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "../lib/i18n";

type BackButtonProps = {
  /** Fallback when history is empty (e.g. direct link). */
  href?: string;
  className?: string;
};

/** Single back arrow for fullscreen pages (Add / image detail). */
export function BackButton({ href = "/", className = "" }: BackButtonProps) {
  const router = useRouter();
  const { t } = useI18n();

  function onClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(href);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("goBack")}
      className={[
        "inline-flex h-10 w-10 items-center justify-center rounded-full",
        "bg-surface/90 text-foreground shadow-sm ring-1 ring-border backdrop-blur-md",
        "transition-colors hover:bg-accent-soft hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 18 9 12l6-6" />
      </svg>
    </button>
  );
}
