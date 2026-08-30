import type { ArchiveItem, MediaAsset, OriginalCharacter } from "./types";

/** Ensure mediaAssets always has at least the cover (legacy-safe). */
export function itemMediaAssets(item: ArchiveItem): MediaAsset[] {
  if (item.mediaAssets && item.mediaAssets.length > 0) {
    return item.mediaAssets;
  }
  if (item.mediaType === "story" && !item.mediaUrl) {
    return [];
  }
  return [
    {
      publicId: "",
      resourceType: item.mediaType === "video" ? "video" : "image",
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

export function isComic(item: ArchiveItem): boolean {
  return item.mediaType === "comic";
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

/** Viewport-sized derivative for the detail stage (not the original file). */
export const DETAIL_DISPLAY_WIDTH = 1600;
export const DETAIL_DISPLAY_QUALITY = 80;

/**
 * Homepage grid source — prefer CDN-optimized thumbnails (Pinterest-style).
 * Small edge-resized bytes beat full originals through any optimizer.
 * Detail first paint uses `displayMediaSrc`; zoom uses `detailMediaSrc`.
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

/** OC board source — CDN thumb, then Bunny-resized original. */
export function ocGridSrc(oc: Pick<OriginalCharacter, "thumbnailUrl" | "mediaUrl">): string {
  if (oc.thumbnailUrl) return oc.thumbnailUrl;
  return withBunnyResize(originalMediaUrl(oc.mediaUrl), {
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
 * Cached grid thumb for instant detail paint (blur-up under the display size).
 */
export function previewAssetSrc(asset: MediaAsset): string {
  if (asset.thumbnailUrl) return asset.thumbnailUrl;
  return withBunnyResize(originalMediaUrl(asset.mediaUrl), {
    width: GRID_THUMB_WIDTH,
    quality: GRID_THUMB_QUALITY,
  });
}

export function previewMediaSrc(item: ArchiveItem): string {
  if (item.mediaType === "video") {
    return item.thumbnailUrl || item.mediaUrl;
  }
  if (item.thumbnailUrl) return item.thumbnailUrl;
  const cover = itemMediaAssets(item)[0];
  if (cover) return previewAssetSrc(cover);
  return withBunnyResize(originalMediaUrl(item.mediaUrl), {
    width: GRID_THUMB_WIDTH,
    quality: GRID_THUMB_QUALITY,
  });
}

/**
 * Detail first paint: viewport-sized WebP from Bunny Optimizer.
 * Originals (up to 50 MB) wait until the user zooms.
 */
export function displayAssetSrc(asset: MediaAsset): string {
  return withBunnyResize(originalMediaUrl(asset.mediaUrl), {
    width: DETAIL_DISPLAY_WIDTH,
    quality: DETAIL_DISPLAY_QUALITY,
  });
}

export function displayMediaSrc(item: ArchiveItem): string {
  if (item.mediaType === "video") {
    return item.thumbnailUrl || item.mediaUrl;
  }
  const cover = itemMediaAssets(item)[0];
  if (cover) return displayAssetSrc(cover);
  return withBunnyResize(originalMediaUrl(item.mediaUrl), {
    width: DETAIL_DISPLAY_WIDTH,
    quality: DETAIL_DISPLAY_QUALITY,
  });
}

/**
 * Full uploaded file (jpg/png/…). Only for zoom / download — not first paint.
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

/** Default pin when a story has no uploaded cover. 3:4 book-cover frame. */
export const STORY_COVER_TEMPLATE = {
  src: "/story-cover-template.jpg",
  width: 864,
  height: 1152,
} as const;

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
