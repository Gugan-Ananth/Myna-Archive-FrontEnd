/**
 * Next/Image loader that resizes Bunny CDN assets at the edge.
 * Avoids the browser → Next optimizer → origin double hop for grid pins.
 *
 * Bunny Optimizer query params: width, height, quality, aspect_ratio.
 * @see https://docs.bunny.net/docs/stream-image-processing
 */
"use client";

import type { ImageLoaderProps } from "next/image";

const BUNNY_HOST_RE = /(^|\.)b-cdn\.net$/i;

export default function bunnyImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  if (!src) return src;

  try {
    const url = new URL(src, typeof window !== "undefined" ? window.location.origin : "http://localhost");

    // Non-Bunny (or relative) assets: pass through unchanged.
    if (!BUNNY_HOST_RE.test(url.hostname)) {
      return src;
    }

    // Width-based responsive thumbs — let height follow aspect ratio.
    const w = Math.min(Math.max(width, 64), 1920);
    url.searchParams.set("width", String(w));
    url.searchParams.set("quality", String(quality ?? 72));
    // WebP is the same format `withBunnyResize` uses. Forcing AVIF on small
    // pins broke some originals (Bunny encoder cap / older Safari).
    url.searchParams.set("format", "webp");
    // Drop fixed height/aspect from stored thumbnail URLs so width drives size.
    url.searchParams.delete("height");
    url.searchParams.delete("aspect_ratio");

    return url.toString();
  } catch {
    return src;
  }
}
