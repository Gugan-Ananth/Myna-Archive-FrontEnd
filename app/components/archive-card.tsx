"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../lib/i18n";
import {
  gridMediaSrc,
  videoThumbnailCandidates,
  withCacheBust,
} from "../lib/media-display";
import type { ArchiveItem } from "../lib/types";

type ArchiveCardProps = {
  item: ArchiveItem;
};

/** Default portrait-leaning frame until natural size is known. */
const PLACEHOLDER = { w: 800, h: 1000 };

/** How long we keep auto-retrying a Stream thumbnail before soft-fail. */
const VIDEO_THUMB_MAX_ATTEMPTS = 18;
const VIDEO_THUMB_RETRY_MS = 5000;

type VideoThumbState = "loading" | "ready" | "processing" | "failed";

/**
 * Pinterest-style pin: full-width media at natural aspect ratio, tight caption.
 * Images use next/image (WebP). Videos use a native img so we can cache-bust
 * and recover once Bunny Stream finishes encoding the still frame.
 */
export function ArchiveCard({ item }: ArchiveCardProps) {
  const { t } = useI18n();
  const isVideo = item.mediaType === "video";
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dims, setDims] = useState(PLACEHOLDER);
  const imageSrc = gridMediaSrc(item);

  return (
    <Link
      href={`/item/${item.id}`}
      className="group block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border transition-[box-shadow,transform] duration-200 group-hover:shadow-md group-hover:ring-border-strong">
        <div
          className={[
            "relative w-full overflow-hidden bg-surface-muted",
            // Videos keep a stable 16:9 stage; images size to natural AR.
            isVideo ? "aspect-video" : "",
          ].join(" ")}
          style={
            !isVideo
              ? {
                  // Reserve exact aspect ratio so the masonry never jumps with empty gaps.
                  aspectRatio: `${dims.w} / ${dims.h}`,
                }
              : undefined
          }
        >
          {/* Image skeleton */}
          {!isVideo && !loaded && !failed && (
            <div
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-muted via-accent-soft/40 to-surface-muted"
              aria-hidden
            />
          )}

          {isVideo ? (
            <VideoThumb
              key={`${item.id}:${item.thumbnailUrl}:${item.mediaUrl}`}
              item={item}
            />
          ) : (
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="(max-width: 420px) 100vw, (max-width: 720px) 50vw, (max-width: 1100px) 33vw, (max-width: 1400px) 25vw, 20vw"
              quality={72}
              className={[
                "object-cover object-center transition-[transform,opacity] duration-300 ease-out will-change-transform group-hover:scale-[1.03]",
                loaded ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setDims({ w: img.naturalWidth, h: img.naturalHeight });
                }
                setLoaded(true);
              }}
              onError={() => {
                setFailed(true);
                setLoaded(true);
              }}
            />
          )}

          {!isVideo && failed && (
            <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-foreground-subtle">
              {t("previewUnavailable")}
            </div>
          )}
        </div>

        <div className="px-2.5 py-2">
          <h2 className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
            {item.name}
          </h2>
        </div>
      </article>
      <span className="sr-only">{isVideo ? t("video") : t("image")}</span>
    </Link>
  );
}

/**
 * Isolated so remounting via `key` resets retry state when Stream URLs change.
 */
function VideoThumb({ item }: { item: ArchiveItem }) {
  const { t } = useI18n();
  const [state, setState] = useState<VideoThumbState>(
    () => (videoThumbnailCandidates(item).length === 0 ? "failed" : "loading"),
  );
  const [thumbAttempt, setThumbAttempt] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(0);

  const thumbCandidates = useMemo(
    () => videoThumbnailCandidates(item),
    [item],
  );

  const videoSrc = useMemo(() => {
    if (thumbCandidates.length === 0) return "";
    const base =
      thumbCandidates[Math.min(candidateIndex, thumbCandidates.length - 1)] ??
      thumbCandidates[0];
    return thumbAttempt > 0 ? withCacheBust(base, thumbAttempt) : base;
  }, [thumbCandidates, candidateIndex, thumbAttempt]);

  // Auto-retry while Bunny Stream is still producing thumbnail.jpg.
  useEffect(() => {
    if (state !== "processing") return;

    const timer = window.setTimeout(() => {
      setThumbAttempt((n) => {
        const next = n + 1;
        if (next > VIDEO_THUMB_MAX_ATTEMPTS) {
          setState("failed");
          return n;
        }
        setState("loading");
        return next;
      });
    }, VIDEO_THUMB_RETRY_MS);

    return () => window.clearTimeout(timer);
  }, [state, thumbAttempt]);

  function onVideoThumbError() {
    if (candidateIndex < thumbCandidates.length - 1) {
      setCandidateIndex((i) => i + 1);
      setState("loading");
      return;
    }
    setState(
      thumbAttempt >= VIDEO_THUMB_MAX_ATTEMPTS ? "failed" : "processing",
    );
  }

  const ready = state === "ready";
  const showPlaceholder = state !== "ready";

  return (
    <>
      {showPlaceholder && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-muted via-accent-soft/50 to-surface-muted px-3 text-center"
          aria-busy={state !== "failed"}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-primary shadow-sm ring-1 ring-border">
            {state === "failed" ? (
              <FilmIcon className="h-5 w-5" />
            ) : (
              <SpinnerIcon className="h-5 w-5 animate-spin" />
            )}
          </span>
          <p className="text-[11px] font-medium leading-snug text-foreground-muted">
            {state === "failed"
              ? t("videoThumbPending")
              : t("videoProcessingShort")}
          </p>
        </div>
      )}

      {videoSrc ? (
        // Native img: Next optimizer can cache Stream 404s and block recovery.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={videoSrc}
          src={videoSrc}
          alt=""
          className={[
            "absolute inset-0 h-full w-full object-cover object-center transition-[transform,opacity] duration-300 ease-out will-change-transform group-hover:scale-[1.03]",
            ready ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onLoad={() => setState("ready")}
          onError={onVideoThumbError}
        />
      ) : null}

      <div
        className={[
          "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent transition-opacity",
          ready ? "opacity-90" : "opacity-40",
        ].join(" ")}
        aria-hidden
      />
      <span
        className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-1 text-[11px] font-medium text-primary shadow-sm ring-1 ring-border backdrop-blur-sm"
        aria-hidden
      >
        <PlayBadgeIcon className="h-3 w-3" />
        {t("video")}
      </span>
      {ready && (
        <span
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        >
          <span className="flex h-11 w-11 scale-95 items-center justify-center rounded-full bg-surface/95 text-primary shadow-md ring-1 ring-border backdrop-blur-sm transition-transform group-hover:scale-100">
            <PlayBadgeIcon className="h-5 w-5 translate-x-px" />
          </span>
        </span>
      )}
    </>
  );
}

function PlayBadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M8.5 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function FilmIcon({ className }: { className?: string }) {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
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
