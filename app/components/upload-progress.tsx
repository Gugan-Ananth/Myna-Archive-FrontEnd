"use client";

import { createPortal } from "react-dom";
import { useEffect } from "react";
import { useI18n } from "../lib/i18n";

type UploadProgressOverlayProps = {
  open: boolean;
  title: string;
  hint?: string | null;
  percent: number;
  onCancel?: () => void;
};

/**
 * Themed batch-upload progress. Replaces the generic full-page spinner so
 * multi-image saves can show "3 / 20 uploaded" instead of an indefinite wait.
 */
export function UploadProgressOverlay({
  open,
  title,
  hint,
  percent,
  onCancel,
}: UploadProgressOverlayProps) {
  const { t } = useI18n();
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex min-h-screen items-center justify-center bg-background/65 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className="app-card w-full max-w-sm rounded-3xl border border-border/80 p-5 shadow-2xl sm:p-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p className="text-lg font-semibold tracking-tight text-foreground tabular-nums">
          {title}
        </p>
        {hint ? (
          <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
            {hint}
          </p>
        ) : null}

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {t("uploadProgress")}
            </span>
            <span className="tabular-nums text-sm font-medium text-primary">
              {clamped}%
            </span>
          </div>
          <div
            className="h-2.5 overflow-hidden rounded-full bg-surface-muted ring-1 ring-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clamped}
            aria-label={title}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
              style={{ width: `${clamped}%` }}
            />
          </div>
        </div>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-medium text-foreground-muted transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("cancelUpload")}
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
