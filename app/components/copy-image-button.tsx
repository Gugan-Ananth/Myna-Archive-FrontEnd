"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { copyImageToClipboard } from "../lib/copy-image";
import { useI18n } from "../lib/i18n";

type CopyImageButtonSize = "sm" | "md";
type CopyImageButtonVariant = "overlay" | "chrome";

type CopyImageButtonProps = {
  src: string;
  className?: string;
  /** `sm` for overlays; `md` matches item-detail toolbar controls. */
  size?: CopyImageButtonSize;
  /**
   * `overlay` — surface chip like StarButton.
   * `chrome` — ghost icon for the dark zoom pill.
   */
  variant?: CopyImageButtonVariant;
};

type CopyStatus = "idle" | "copying" | "copied" | "error";

const SIZE_CLASS: Record<CopyImageButtonSize, { button: string; icon: string }> =
  {
    sm: { button: "h-7 w-7", icon: "h-3.5 w-3.5" },
    md: { button: "h-10 w-10", icon: "h-5 w-5" },
  };

/** Copies the image at `src` onto the system clipboard. */
export function CopyImageButton({
  src,
  className,
  size = "sm",
  variant = "overlay",
}: CopyImageButtonProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetRef = useRef<number>(0);
  const sizeClass = SIZE_CLASS[size];
  const busy = status === "copying";
  const label =
    status === "copied"
      ? t("imageCopied")
      : status === "error"
        ? t("couldNotCopyImage")
        : status === "copying"
          ? t("copyingImage")
          : t("copyImage");

  useEffect(() => {
    return () => window.clearTimeout(resetRef.current);
  }, []);

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !src) return;

    window.clearTimeout(resetRef.current);
    setStatus("copying");
    try {
      await copyImageToClipboard(src);
      setStatus("copied");
      resetRef.current = window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("error");
      resetRef.current = window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  const chrome = variant === "chrome";

  return (
    <span className={["relative inline-flex", className ?? ""].join(" ")}>
      <button
        type="button"
        data-image-copy=""
        onClick={(event) => void handleClick(event)}
        onContextMenu={(event) => event.stopPropagation()}
        disabled={busy || !src}
        aria-label={label}
        title={label}
        className={
          chrome
            ? [
                "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 disabled:opacity-35",
              ].join(" ")
            : [
                "inline-flex items-center justify-center rounded-full shadow-sm ring-1 backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                sizeClass.button,
                status === "copied"
                  ? "bg-surface/95 text-primary ring-border hover:bg-accent-soft"
                  : status === "error"
                    ? "bg-surface/95 text-red-600 ring-border"
                    : "bg-surface/95 text-foreground ring-border hover:bg-accent-soft hover:text-primary",
                busy ? "cursor-wait opacity-60" : "",
              ].join(" ")
        }
      >
        {status === "copied" ? (
          <CheckIcon className={chrome ? "h-4 w-4" : sizeClass.icon} />
        ) : status === "copying" ? (
          <SpinnerIcon className={chrome ? "h-4 w-4" : sizeClass.icon} />
        ) : (
          <CopyIcon className={chrome ? "h-4 w-4" : sizeClass.icon} />
        )}
      </button>
      {status === "error" && !chrome ? (
        <span
          role="status"
          className="absolute left-0 top-[calc(100%+0.45rem)] z-50 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg bg-foreground px-2.5 py-1.5 text-xs leading-snug text-background shadow-md"
        >
          {t("couldNotCopyImage")}
        </span>
      ) : null}
    </span>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
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
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={[className, "animate-spin"].join(" ")}
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
