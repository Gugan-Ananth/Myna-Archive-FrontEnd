"use client";

import { useState } from "react";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { useI18n } from "../lib/i18n";
import {
  GRID_THUMB_QUALITY,
  orientationFromSize,
} from "../lib/media-display";
import {
  storyCoverAsset,
  storyCoverDisplay,
  storyCoverSize,
} from "../lib/story-content";
import type { ArchiveItem } from "../lib/types";
import { LoadingImage } from "./global-loading";

/** Cover well aspect from stored size, then the decoded still if needed. */
export function useStoryCoverFrame(item: ArchiveItem): {
  aspect: number;
  landscape: boolean;
  onNaturalSize: (width: number, height: number) => void;
} {
  const stored = storyCoverSize(item);
  const coverKey = `${item.id}:${item.mediaUrl}:${item.thumbnailUrl}`;
  const [natural, setNatural] = useState<{
    key: string;
    width: number;
    height: number;
  } | null>(null);
  if (natural && natural.key !== coverKey) {
    setNatural(null);
  }
  const dims =
    stored.measured || natural?.key !== coverKey
      ? stored
      : { width: natural.width, height: natural.height };
  const aspect = dims.height > 0 ? dims.width / dims.height : 3 / 4;

  function onNaturalSize(width: number, height: number) {
    if (stored.measured) return;
    if (!storyCoverAsset(item)) return;
    if (width <= 0 || height <= 0) return;
    if (
      natural?.key === coverKey &&
      natural.width === width &&
      natural.height === height
    ) {
      return;
    }
    setNatural({ key: coverKey, width, height });
  }

  return {
    aspect,
    landscape: orientationFromSize(dims.width, dims.height) === "landscape",
    onNaturalSize,
  };
}

type StoryCoverStillProps = {
  item: ArchiveItem;
  sizes: string;
  alt?: string;
  priority?: boolean;
  /** `contain` keeps landscape covers whole inside a shared grid well. */
  fit?: "cover" | "contain";
  onNaturalSize?: (width: number, height: number) => void;
};

/**
 * Chapter or series still: that item's own cover, or the story cover template.
 */
export function StoryCoverStill({
  item,
  sizes,
  alt = "",
  priority = false,
  fit = "cover",
  onNaturalSize,
}: StoryCoverStillProps) {
  const { t } = useI18n();
  const { src, hasCover } = storyCoverDisplay(item);
  return (
    <LoadingImage
      src={src}
      alt={alt}
      fill
      priority={priority}
      loader={hasCover ? bunnyImageLoader : undefined}
      unoptimized={!hasCover}
      sizes={sizes}
      quality={GRID_THUMB_QUALITY}
      className={
        fit === "contain"
          ? "object-contain object-center"
          : "object-cover object-center"
      }
      fallbackLabel={t("previewUnavailable")}
      onLoad={(event) => {
        if (!hasCover) return;
        const img = event.currentTarget;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          onNaturalSize?.(img.naturalWidth, img.naturalHeight);
        }
      }}
    />
  );
}
