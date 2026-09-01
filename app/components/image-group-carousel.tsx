"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useI18n } from "../lib/i18n";
import {
  detailAssetSrc,
  displayAssetSrc,
  previewAssetSrc,
  withBunnyResize,
} from "../lib/media-display";
import { prefetchMediaUrl } from "../lib/prefetch-media";
import type { MediaAsset } from "../lib/types";
import { ImageZoomViewer } from "./image-zoom-viewer";

type ImageGroupCarouselProps = {
  assets: MediaAsset[];
  title: string;
  className?: string;
  /** Notifies parent so chrome (e.g. top badge) can show “2 / 5”. */
  onIndexChange?: (index: number, total: number) => void;
};

const FILMSTRIP_THUMB_WIDTH = 96;

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
  const stripRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const focusActiveThumbRef = useRef(false);
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

  // Keep the active thumb visible in a long strip.
  useEffect(() => {
    const root = stripRef.current;
    if (!root) return;
    const active = root.querySelector<HTMLElement>('[aria-current="true"]');
    active?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
    if (focusActiveThumbRef.current) {
      focusActiveThumbRef.current = false;
      active?.focus({ preventScroll: true });
    }
  }, [safeIndex]);

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
      if (
        stripRef.current &&
        event.target instanceof Node &&
        stripRef.current.contains(event.target)
      ) {
        return;
      }
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

            <div
              ref={stripRef}
              role="tablist"
              aria-label={t("imageGroup")}
              onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
                const isNavigationKey =
                  event.key === "ArrowLeft" ||
                  event.key === "ArrowRight" ||
                  event.key === "Home" ||
                  event.key === "End";
                if (!isNavigationKey) return;
                const target = event.target;
                const cameFromThumbnail =
                  target instanceof HTMLElement &&
                  target.getAttribute("role") === "tab";
                if (cameFromThumbnail) focusActiveThumbRef.current = true;
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  go(-1);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  go(1);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  goTo(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  goTo(count - 1);
                }
              }}
              className={[
                "pointer-events-auto flex max-w-[min(100%,36rem)] items-center gap-1.5 overflow-x-auto overscroll-x-contain",
                "rounded-2xl bg-black/50 p-1.5 shadow-lg ring-1 ring-white/12 backdrop-blur-md",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              ].join(" ")}
            >
              {assets.map((asset, i) => {
                const active = i === safeIndex;
                const thumbSrc = filmstripThumbSrc(asset);
                return (
                  <button
                    key={asset.publicId || `asset-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-current={active ? "true" : undefined}
                    aria-label={t("goToImage", { n: i + 1 })}
                    onClick={() => goTo(i)}
                    className={[
                      "relative h-11 w-11 shrink-0 overflow-hidden rounded-xl transition-[box-shadow,transform,opacity] duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
                      active
                        ? "scale-100 opacity-100 ring-2 ring-primary ring-offset-1 ring-offset-black/50"
                        : "opacity-70 ring-1 ring-white/15 hover:opacity-100 hover:ring-white/40",
                    ].join(" ")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbSrc}
                      alt=""
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function filmstripThumbSrc(asset: MediaAsset): string {
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  return withBunnyResize(detailAssetSrc(asset), {
    width: FILMSTRIP_THUMB_WIDTH,
    quality: 70,
  });
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
