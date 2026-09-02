"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useI18n } from "../lib/i18n";
import {
  detailAssetSrc,
  displayAssetSrc,
  previewAssetSrc,
} from "../lib/media-display";
import { prefetchMediaUrl } from "../lib/prefetch-media";
import type { MediaAsset } from "../lib/types";
import { ImageZoomViewer } from "./image-zoom-viewer";
import { MediaFilmstrip } from "./media-filmstrip";

type ImageGroupCarouselProps = {
  assets: MediaAsset[];
  title: string;
  className?: string;
  /** Notifies parent so chrome (e.g. top badge) can show “2 / 5”. */
  onIndexChange?: (index: number, total: number) => void;
};

/**
 * Detail-stage viewer for image groups.
 *
 * Navigation is intentionally not side chevrons — those collide with back /
 * details-panel controls. Instead:
 * - filmstrip thumbnails (primary, glanceable)
 * - keyboard ← →
 * - horizontal swipe on the stage (when not zoomed)
 * - optional hover edge zones (desktop only, no permanent icons)
 */
export function ImageGroupCarousel({
  assets,
  title,
  className = "",
  onIndexChange,
}: ImageGroupCarouselProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const count = assets.length;
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, count - 1));
  const current = assets[safeIndex];

  const goTo = useCallback(
    (next: number) => {
      if (count <= 1) return;
      const clamped = ((next % count) + count) % count;
      setIndex(clamped);
    },
    [count],
  );

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setIndex((currentIndex) => {
        const normalized = Math.min(
          Math.max(0, currentIndex),
          Math.max(0, count - 1),
        );
        return ((normalized + delta) % count + count) % count;
      });
    },
    [count],
  );

  // Parent must pass a stable callback (useCallback). Reporting only when
  // index/total change avoids update loops from inline lambdas.
  useEffect(() => {
    onIndexChange?.(safeIndex, count);
  }, [safeIndex, count, onIndexChange]);

  useEffect(() => {
    const neighbors = [assets[safeIndex + 1], assets[safeIndex - 1]];
    for (const asset of neighbors) {
      if (asset) prefetchMediaUrl(displayAssetSrc(asset));
    }
  }, [assets, safeIndex]);

  useEffect(() => {
    if (count <= 1) return;
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go]);

  if (!current) {
    return (
      <div
        className={[
          "flex items-center justify-center bg-neutral-950 text-sm text-white/60",
          className,
        ].join(" ")}
      >
        {t("couldNotLoadImage")}
      </div>
    );
  }

  const src = displayAssetSrc(current);
  const previewSrc = previewAssetSrc(current);
  const originalSrc = detailAssetSrc(current);
  const isGroup = count > 1;

  function onStageTouchStart(event: ReactTouchEvent) {
    // Don't steal multi-touch (pinch zoom) or swipe while zoomed.
    if (!isGroup || zoomed || event.touches.length > 1) {
      touchRef.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onStageTouchEnd(event: ReactTouchEvent) {
    if (!isGroup || zoomed || !touchRef.current) return;
    // Still multi-touch → treat as pinch, not a slide change.
    if (event.touches.length > 0) {
      touchRef.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchRef.current.x;
    const dy = touch.clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    go(dx < 0 ? 1 : -1);
  }

  return (
    <div
      className={["h-full w-full", className].join(" ")}
    >
      <div
        className="absolute inset-0"
        onTouchStart={onStageTouchStart}
        onTouchEnd={onStageTouchEnd}
      >
        <ImageZoomViewer
          key={`${current.publicId}:${src}`}
          src={src}
          previewSrc={previewSrc}
          originalSrc={originalSrc}
          alt={
            isGroup
              ? t("imageOfGroup", {
                  name: title,
                  n: safeIndex + 1,
                  total: count,
                })
              : title
          }
          className="h-full w-full"
          // Lift zoom chrome above the filmstrip; keep it bottom-center of the stage.
          controlsClassName={
            isGroup
              ? "bottom-[5.75rem] left-1/2 -translate-x-1/2 sm:bottom-[6.25rem]"
              : undefined
          }
          onZoomChange={setZoomed}
        />
      </div>

      {isGroup ? (
        <>
          {/*
            Desktop: invisible edge zones — hover reveals a soft wash only
            (no permanent chevrons competing with back / details chrome).
          */}
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t("previousImage")}
            className="group/edge absolute inset-y-0 left-0 z-20 hidden w-[min(4.5rem,14%)] items-stretch sm:flex"
          >
            <span
              className="pointer-events-none flex w-full items-center justify-start bg-gradient-to-r from-black/35 to-transparent pl-2 opacity-0 transition-opacity duration-200 group-hover/edge:opacity-100 group-focus-visible/edge:opacity-100"
              aria-hidden
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
                <ChevronLeftIcon className="h-4 w-4" />
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t("nextImage")}
            className="group/edge absolute inset-y-0 right-0 z-20 hidden w-[min(4.5rem,14%)] items-stretch sm:flex"
          >
            <span
              className="pointer-events-none flex w-full items-center justify-end bg-gradient-to-l from-black/35 to-transparent pr-2 opacity-0 transition-opacity duration-200 group-hover/edge:opacity-100 group-focus-visible/edge:opacity-100"
              aria-hidden
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white/90 ring-1 ring-white/15 backdrop-blur-sm">
                <ChevronRightIcon className="h-4 w-4" />
              </span>
            </span>
          </button>

          {/* Filmstrip — primary group chrome; distinct from page navigation */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-black/55 via-black/25 to-transparent px-3 pb-3 pt-14 sm:px-4 sm:pb-4">
            <p className="text-lg font-bold tabular-nums tracking-wide text-white sm:text-xl">
              {t("imagePosition", { n: safeIndex + 1, total: count })}
            </p>
            <MediaFilmstrip
              assets={assets}
              activeIndex={safeIndex}
              onSelect={goTo}
              ariaLabel={t("imageGroup")}
              itemLabel={(index) => t("goToImage", { n: index + 1 })}
              wrap
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
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
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
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
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
