"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef } from "react";
import { useI18n } from "../lib/i18n";

type ConfirmDialogProps = {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  busy?: boolean;
  tone?: "primary" | "danger";
};

/** Centered, theme-aware confirmation surface used instead of window.confirm. */
export function ConfirmDialog({
  open,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  busy = false,
  tone = "danger",
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!open) return;

    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActive instanceof HTMLElement) previousActive.focus();
    };
  }, [busy, onCancel, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex min-h-screen items-center justify-center bg-background/65 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="app-card w-full max-w-md rounded-3xl border border-border/80 p-5 shadow-2xl sm:p-6"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-primary ring-1 ring-primary/15">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3.75 21 20.25H3L12 3.75Z" />
              <path d="M12 9v4.5M12 17.25h.01" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {t("confirmAction")}
            </h2>
            <p
              id={messageId}
              className="mt-2 text-sm leading-relaxed text-foreground-muted"
            >
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-medium text-foreground-muted transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={[
              "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              tone === "danger"
                ? "bg-danger hover:bg-danger/90"
                : "bg-primary text-primary-foreground hover:bg-primary-hover",
            ].join(" ")}
          >
            {busy ? t("saving") : confirmLabel || t("confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
