"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import { StatusMascot } from "./status-mascot";

type HomeFiltersNoticeProps = {
  query: string;
  tags: string[];
  created: boolean;
  /** True when the just-created item is a video (Stream still encoding). */
  createdVideo?: boolean;
};

const TOAST_MS = 3800;
const TOAST_VIDEO_MS = 6200;

/**
 * Search status + success toast after create.
 * Toast is a high-contrast floating snackbar (primary surface + light text)
 * so it reads clearly against the light archive UI without leaving the theme.
 */
export function HomeFiltersNotice({
  query,
  created,
  createdVideo = false,
}: HomeFiltersNoticeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [toastVisible, setToastVisible] = useState(created);
  const [toastExiting, setToastExiting] = useState(false);
  const toastMs = createdVideo ? TOAST_VIDEO_MS : TOAST_MS;

  useEffect(() => {
    if (!created) return;

    const frame = window.requestAnimationFrame(() => {
      setToastVisible(true);
      setToastExiting(false);
    });

    const exitTimer = setTimeout(() => setToastExiting(true), toastMs - 320);
    const clearTimer = setTimeout(() => {
      setToastVisible(false);
      dismissCreatedParam();
    }, toastMs);

    return () => {
      window.cancelAnimationFrame(frame);
      clearTimeout(exitTimer);
      clearTimeout(clearTimer);
    };
  }, [created, createdVideo, router, toastMs]);

  function dismissCreatedParam() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("created");
    next.delete("video");
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }

  function dismissToast() {
    setToastExiting(true);
    window.setTimeout(() => {
      setToastVisible(false);
      dismissCreatedParam();
    }, 220);
  }

  return (
    <>
      {query ? (
        <div className="mb-2">
          <p className="text-sm text-foreground-muted">
            {t("resultsFor", { query })}
          </p>
        </div>
      ) : null}

      {toastVisible && created ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+5.25rem))] pt-4 md:pb-6"
          aria-live="polite"
        >
          <div
            role="status"
            className={[
              "pointer-events-auto relative flex w-full max-w-md items-center gap-3 overflow-hidden rounded-2xl",
              // Solid brand fill + white type = clear contrast on light pages
              "bg-primary text-primary-foreground shadow-[0_12px_40px_-8px_rgba(109,40,217,0.55),0_4px_14px_-4px_rgba(30,27,46,0.2)]",
              "ring-1 ring-primary-hover/40",
              toastExiting
                ? "animate-[toast-out_240ms_ease-in_forwards]"
                : "animate-[toast-in_280ms_cubic-bezier(0.22,1,0.36,1)]",
            ].join(" ")}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 pr-1 pb-4 sm:px-4">
              <StatusMascot
                mood={createdVideo ? "success" : "celebrate"}
                size="sm"
                className="shrink-0"
              />
              <p className="min-w-0 text-sm font-semibold leading-snug tracking-tight">
                {createdVideo ? t("savedVideoProcessing") : t("savedToArchive")}
              </p>
            </div>

            <button
              type="button"
              onClick={dismissToast}
              aria-label={t("dismiss")}
              className="mr-2 mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-foreground/85 transition-colors hover:bg-white/15 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <CloseIcon className="h-4 w-4" />
            </button>

            {/* Auto-dismiss progress rail */}
            <div
              className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-black/15"
              aria-hidden
            >
              <div
                className="h-full origin-left bg-white/80"
                style={{
                  animation: toastExiting
                    ? "none"
                    : `toast-progress ${toastMs}ms linear forwards`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
