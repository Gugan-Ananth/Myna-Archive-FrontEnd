"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import bunnyImageLoader from "../lib/bunny-image-loader";
import {
  blurHashPlaceholderFallback,
  blurHashToDataURL,
} from "../lib/display-metadata";
import { useI18n } from "../lib/i18n";
import {
  isImageGroup,
  itemMediaAssets,
  gridMediaSrc,
  STORY_COVER_TEMPLATE,
  videoThumbnailCandidates,
  withCacheBust,
} from "../lib/media-display";
import type { ArchiveItem } from "../lib/types";

/** True only after client hydration — avoids BlurHash canvas SSR mismatch. */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type ArchiveCardProps = {
  item: ArchiveItem;
  /** First viewport pins: preload + high fetch priority (Pinterest above-the-fold). */
  priority?: boolean;
};

/** Default portrait-leaning frame until natural size is known. */
const PLACEHOLDER = { w: 800, h: 1000 };

function initialDims(item: ArchiveItem): { w: number; h: number } {
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return { w: item.width, h: item.height };
  }
  if (item.mediaType === "video") return { w: 16, h: 9 };
  if (item.mediaType === "story" && !(item.width && item.height)) {
    return { w: STORY_COVER_TEMPLATE.width, h: STORY_COVER_TEMPLATE.height };
  }
  return PLACEHOLDER;
}

/** How long we keep auto-retrying a Stream thumbnail before soft-fail. */
const VIDEO_THUMB_MAX_ATTEMPTS = 18;
const VIDEO_THUMB_RETRY_MS = 5000;

type VideoThumbState = "loading" | "ready" | "processing" | "failed";

/**
 * Pinterest-style pin: media only, at the file’s natural aspect ratio.
 * Images use next/image + Bunny edge resize (WebP). Videos use a native img
 * so we can cache-bust and recover once Bunny Stream finishes the still frame.
 */
export function ArchiveCard({ item, priority = false }: ArchiveCardProps) {
  const { t } = useI18n();
  const isVideo = item.mediaType === "video";
  const isStory = item.mediaType === "story";
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const hasStoredDims = Boolean(item.width && item.height);
  const [dims, setDims] = useState(() => initialDims(item));
  const isClient = useIsClient();
  // Same placeholder on server + first client paint; decode BlurHash only after mount.
  const blurDataUrl = useMemo(() => {
    if (isClient && item.blurHash) {
      const url = blurHashToDataURL(item.blurHash);
      if (url) return url;
    }
    return blurHashPlaceholderFallback();
  }, [isClient, item.blurHash]);
  const imageSrc = gridMediaSrc(item);
  const storyCover = isStory && Boolean(imageSrc);

  function applyNaturalSize(width: number, height: number) {
    if (hasStoredDims || width <= 0 || height <= 0) return;
    setDims({ w: width, h: height });
  }

  return (
    <Link
      href={`/item/${item.id}`}
      prefetch
      className="group block w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border transition-[box-shadow,transform] duration-200 group-hover:shadow-md group-hover:ring-border-strong [content-visibility:auto] [contain-intrinsic-size:auto_280px]">
        <div
          className="relative w-full overflow-hidden bg-surface-muted"
          style={{ aspectRatio: `${dims.w} / ${dims.h}` }}
        >
          {/* Image skeleton */}
          {!isVideo && !isStory && !loaded && !failed && (
            <div
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-muted via-accent-soft/40 to-surface-muted"
              aria-hidden
            />
          )}

          {isVideo ? (
            <VideoThumb
              key={`${item.id}:${item.thumbnailUrl}:${item.mediaUrl}`}
              item={item}
              priority={priority}
              onNaturalSize={applyNaturalSize}
            />
          ) : isStory && !storyCover ? (
            <Image
              src={STORY_COVER_TEMPLATE.src}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 380px) 100vw, (max-width: 620px) 50vw, (max-width: 860px) 33vw, (max-width: 1100px) 25vw, 20vw"
              className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <Image
              src={imageSrc}
              alt=""
              fill
              loader={bunnyImageLoader}
              sizes="(max-width: 380px) 100vw, (max-width: 620px) 50vw, (max-width: 860px) 33vw, (max-width: 1100px) 25vw, (max-width: 1400px) 20vw, (max-width: 1680px) 16vw, 14vw"
              quality={72}
              // Next 16: `preload` replaces deprecated `priority`.
              preload={priority}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
              placeholder="blur"
              blurDataURL={blurDataUrl}
              className={[
                "object-cover object-center transition-[transform,opacity] duration-300 ease-out will-change-transform group-hover:scale-[1.03]",
                loaded ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onLoad={(event) => {
                const img = event.currentTarget;
                applyNaturalSize(img.naturalWidth, img.naturalHeight);
                setLoaded(true);
              }}
              onError={() => {
                setFailed(true);
                setLoaded(true);
              }}
            />
          )}

          {!isVideo && !isStory && failed && (
            <div className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-foreground-subtle">
              {t("previewUnavailable")}
            </div>
          )}

          {!isVideo && isImageGroup(item) ? (
            <span
              className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-1 text-[11px] font-medium text-primary shadow-sm ring-1 ring-border backdrop-blur-sm"
              aria-hidden
            >
              <StackBadgeIcon className="h-3 w-3" />
              {itemMediaAssets(item).length}
            </span>
          ) : null}
        </div>
      </article>
      <span className="sr-only">
        {isVideo
          ? t("video")
          : isStory
            ? t("navStories")
            : isImageGroup(item)
              ? t("photoCount", { count: itemMediaAssets(item).length })
              : t("image")}
      </span>
    </Link>
  );
}

/**
 * Isolated so remounting via `key` resets retry state when Stream URLs change.
 */
function VideoThumb({
  item,
  priority = false,
  onNaturalSize,
}: {
  item: ArchiveItem;
  priority?: boolean;
  onNaturalSize?: (width: number, height: number) => void;
}) {
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
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className={[
            "absolute inset-0 h-full w-full object-cover object-center transition-[transform,opacity] duration-300 ease-out will-change-transform group-hover:scale-[1.03]",
            ready ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onLoad={(event) => {
            const img = event.currentTarget;
            onNaturalSize?.(img.naturalWidth, img.naturalHeight);
            setState("ready");
          }}
          onError={onVideoThumbError}
        />
      ) : null}

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

function StackBadgeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 3h9a2 2 0 0 1 2 2v9" />
    </svg>
  );
}
