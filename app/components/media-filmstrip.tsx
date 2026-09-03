"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { detailAssetSrc, withBunnyResize } from "../lib/media-display";
import type { MediaAsset } from "../lib/types";
import { BrokenImageIcon, SafeImg } from "./broken-image-fallback";

type MediaFilmstripProps = {
  assets: MediaAsset[];
  activeIndex: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
  itemLabel: (index: number) => string;
  wrap?: boolean;
};

const FILMSTRIP_THUMB_WIDTH = 96;
const FILMSTRIP_THUMB_QUALITY = 58;

/** Compact, low-quality thumbnail navigation for image groups and comic pages. */
export function MediaFilmstrip({
  assets,
  activeIndex,
  onSelect,
  ariaLabel,
  itemLabel,
  wrap = false,
}: MediaFilmstripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const focusActiveThumbRef = useRef(false);

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
  }, [activeIndex]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const cameFromThumbnail =
      event.target instanceof HTMLElement &&
      event.target.getAttribute("role") === "tab";
    if (cameFromThumbnail) focusActiveThumbRef.current = true;

    const lastIndex = assets.length - 1;
    if (event.key === "Home") {
      onSelect(0);
      return;
    }
    if (event.key === "End") {
      onSelect(lastIndex);
      return;
    }

    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = activeIndex + delta;
    onSelect(
      wrap
        ? ((next % assets.length) + assets.length) % assets.length
        : Math.min(Math.max(0, next), lastIndex),
    );
  }

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="pointer-events-auto flex max-w-[min(100%,36rem)] items-center gap-1.5 overflow-x-auto overscroll-x-contain rounded-2xl bg-black/50 p-1.5 shadow-lg ring-1 ring-white/12 backdrop-blur-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {assets.map((asset, index) => {
        const active = index === activeIndex;
        return (
          <button
            key={asset.publicId || `asset-${index}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-current={active ? "true" : undefined}
            aria-label={itemLabel(index)}
            onClick={() => onSelect(index)}
            className={[
              "relative h-11 w-11 shrink-0 overflow-hidden rounded-xl transition-[box-shadow,transform,opacity] duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black/40",
              active
                ? "scale-100 opacity-100 ring-2 ring-primary ring-offset-1 ring-offset-black/50"
                : "opacity-70 ring-1 ring-white/15 hover:opacity-100 hover:ring-white/40",
            ].join(" ")}
          >
            <SafeImg
              src={filmstripThumbSrc(asset)}
              alt=""
              draggable={false}
              loading="eager"
              fetchPriority="low"
              decoding="async"
              className="h-full w-full object-cover"
              compactFallback
              fallback={
                <span
                  className="flex h-full w-full items-center justify-center bg-white/10 text-white/45"
                  aria-hidden
                >
                  <BrokenImageIcon className="h-3.5 w-3.5" />
                </span>
              }
            />
          </button>
        );
      })}
    </div>
  );
}

function filmstripThumbSrc(asset: MediaAsset): string {
  return withBunnyResize(asset.thumbnailUrl || detailAssetSrc(asset), {
    width: FILMSTRIP_THUMB_WIDTH,
    quality: FILMSTRIP_THUMB_QUALITY,
  });
}
