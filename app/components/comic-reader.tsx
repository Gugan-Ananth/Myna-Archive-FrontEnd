"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";
import {
  detailAssetSrc,
  displayAssetSrc,
  previewAssetSrc,
} from "../lib/media-display";
import { prefetchMediaUrl } from "../lib/prefetch-media";
import type { MediaAsset } from "../lib/types";
import { ImageZoomViewer } from "./image-zoom-viewer";

type ComicReaderProps = {
  assets: MediaAsset[];
  title: string;
  className?: string;
  onIndexChange?: (index: number, total: number) => void;
};

/**
 * One-page comic reader: the page starts contained, a second click switches
 * to fill-width zoom, and left/right arrows move between pages.
 */
export function ComicReader({
  assets,
  title,
  className = "",
  onIndexChange,
}: ComicReaderProps) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const count = assets.length;
  const safeIndex = Math.min(Math.max(0, index), Math.max(0, count - 1));
  const current = assets[safeIndex];

  const goTo = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(Math.min(Math.max(0, next), count - 1));
    },
    [count],
  );

  const go = useCallback(
    (delta: number) => {
      goTo(safeIndex + delta);
    },
    [goTo, safeIndex],
  );

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
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(count - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go, goTo]);

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
  const many = count > 1;

  return (
    <div className={["relative h-full w-full", className].join(" ")}>
      <ImageZoomViewer
        key={`${current.publicId}:${src}:${safeIndex}`}
        src={src}
        previewSrc={previewSrc}
        originalSrc={originalSrc}
        alt={t("imageOfGroup", {
          name: title,
          n: safeIndex + 1,
          total: count,
        })}
        className="h-full w-full"
        initialMode="contain"
        clickTogglesZoom
      />

      {many ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={safeIndex === 0}
            aria-label={t("previousPage")}
            className="group/edge absolute inset-y-0 left-0 z-20 hidden w-[min(4.5rem,14%)] items-stretch disabled:pointer-events-none sm:flex"
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
            disabled={safeIndex >= count - 1}
            aria-label={t("nextPage")}
            className="group/edge absolute inset-y-0 right-0 z-20 hidden w-[min(4.5rem,14%)] items-stretch disabled:pointer-events-none sm:flex"
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
