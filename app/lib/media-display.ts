import type { ArchiveItem, MediaAsset } from "./types";

/** Ensure mediaAssets always has at least the cover (legacy-safe). */
export function itemMediaAssets(item: ArchiveItem): MediaAsset[] {
  if (item.mediaAssets && item.mediaAssets.length > 0) {
    return item.mediaAssets;
  }
  return [
    {
      publicId: "",
      resourceType: item.mediaType,
      mediaUrl: item.mediaUrl,
      thumbnailUrl: item.thumbnailUrl,
      width: item.width,
      height: item.height,
      blurHash: item.blurHash,
    },
  ];
}

export function isImageGroup(item: ArchiveItem): boolean {
  return item.mediaType === "image" && itemMediaAssets(item).length > 1;
}

/** Strip CDN/optimizer query string so we get the original asset URL. */
export function originalMediaUrl(url: string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.split("?")[0]?.split("#")[0] ?? url;
  }
}

/** Default Bunny Optimizer params for grid pins (~column width). */
export const GRID_THUMB_WIDTH = 480;
export const GRID_THUMB_QUALITY = 72;

/**
 * Homepage grid source — prefer CDN-optimized thumbnails (Pinterest-style).
 * Small edge-resized bytes beat full originals through any optimizer.
 * Detail page still uses `detailMediaSrc` (original file).
 */
export function gridMediaSrc(item: ArchiveItem): string {
  if (item.mediaType === "video") {
    return item.thumbnailUrl || item.mediaUrl;
  }

  // Backend already stamps thumbnailUrl with Bunny Optimizer query params.
  if (item.thumbnailUrl) {
    return item.thumbnailUrl;
  }

  const original = originalMediaUrl(item.mediaUrl);
  return withBunnyResize(original, {
    width: GRID_THUMB_WIDTH,
    quality: GRID_THUMB_QUALITY,
  });
}

/**
 * Apply Bunny Optimizer resize params when the host is a Pull Zone.
 * No-ops for non-Bunny URLs.
 */
export function withBunnyResize(
  url: string,
  opts: { width: number; quality?: number },
): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)b-cdn\.net$/i.test(parsed.hostname)) return url;
    parsed.searchParams.set("width", String(opts.width));
    parsed.searchParams.set("quality", String(opts.quality ?? GRID_THUMB_QUALITY));
    parsed.searchParams.set("format", "webp");
    parsed.searchParams.delete("height");
    parsed.searchParams.delete("aspect_ratio");
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Tiny solid purple blur used as next/image blur placeholder. */
export const GRID_BLUR_DATA_URL =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="20"><rect width="100%" height="100%" fill="#ede9fe"/></svg>`,
  );

/**
 * Detail / zoom: original uploaded file (jpg/png/…), no Next optimizer, no WebP.
 * Render with a native `<img>` so the browser loads the real asset bytes.
 */
export function detailMediaSrc(item: ArchiveItem): string {
  return originalMediaUrl(item.mediaUrl);
}

export function detailAssetSrc(asset: MediaAsset): string {
  return originalMediaUrl(asset.mediaUrl);
}

/**
 * Bust browser / CDN caches so a previously-404 Stream asset can be rechecked
 * after Bunny finishes encoding.
 */
export function withCacheBust(url: string, token: number | string): string {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("myna_cb", String(token));
    return parsed.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}myna_cb=${encodeURIComponent(String(token))}`;
  }
}

const PROGRESSIVE_HEIGHTS = [720, 480, 360, 240, 1080] as const;

/**
 * Bunny Stream progressive MP4s appear as renditions finish encoding.
 * Prefer the stored height first, then common lower/higher fallbacks so
 * playback can start before the default 720p rendition is ready.
 */
export function alternateVideoSources(mediaUrl: string): string[] {
  if (!mediaUrl) return [];

  const match = mediaUrl.match(/^(.*\/play_)(\d+)(p\.mp4)(\?.*)?$/i);
  if (!match) return [mediaUrl];

  const [, prefix, heightRaw, suffix, query = ""] = match;
  const preferred = Number(heightRaw);
  const heights = [
    preferred,
    ...PROGRESSIVE_HEIGHTS.filter((h) => h !== preferred),
  ];

  return heights.map((height) => `${prefix}${height}${suffix}${query}`);
}

/**
 * Bunny Stream still frame for a video. Safe to retry with cache-bust while
 * status is still encoding (thumbnail.jpg 404s until ready).
 */
export function videoThumbnailCandidates(item: ArchiveItem): string[] {
  const urls: string[] = [];
  if (item.thumbnailUrl) urls.push(item.thumbnailUrl);

  // Derive still path from progressive URL when thumbnail field is empty/stale.
  const media = item.mediaUrl;
  if (media) {
    const still = media.replace(/\/play_\d+p\.mp4(?:\?.*)?$/i, "/thumbnail.jpg");
    if (still !== media && !urls.includes(still)) {
      urls.push(still);
    }
  }

  return urls;
}

export type ImageOrientation = "portrait" | "landscape" | "square";

export function orientationFromSize(
  width: number,
  height: number,
): ImageOrientation {
  if (!width || !height) return "landscape";
  const ratio = width / height;
  if (ratio < 0.92) return "portrait";
  if (ratio > 1.08) return "landscape";
  return "square";
}
