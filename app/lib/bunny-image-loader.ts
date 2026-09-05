/**
 * next/image loader for archive previews.
 * The Bunny pull zone returns originals (Optimizer is off), so thumbs are
 * resized and cached by `/api/media/thumb` instead of the CDN or `/_next/image`.
 */
"use client";

import type { ImageLoaderProps } from "next/image";
import {
  GRID_THUMB_QUALITY,
  GRID_THUMB_WIDTH,
  isStoredPreviewPath,
  nextOptimizerSrc,
} from "./media-display";

const BUNNY_HOST_RE = /(^|\.)b-cdn\.net$/i;

export default function bunnyImageLoader({
  src,
  quality,
}: ImageLoaderProps): string {
  if (!src) return src;

  try {
    const url = new URL(
      src,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    if (!BUNNY_HOST_RE.test(url.hostname)) {
      return src;
    }
    // Stored `{uuid}-preview.webp` is already the <1 MB grid file.
    if (isStoredPreviewPath(src)) {
      return src;
    }
    // Legacy originals (Optimizer query was a no-op): resize locally.
    return nextOptimizerSrc(
      src,
      GRID_THUMB_WIDTH,
      quality ?? GRID_THUMB_QUALITY,
    );
  } catch {
    return src;
  }
}
