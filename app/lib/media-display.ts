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

/**
 * Lightweight preview derivatives for cards, filmstrips, and detail first paint.
 * Prefer the stored `{uuid}-preview.webp` file (under 1 MB). Legacy rows
 * that still point thumbnailUrl at the original use `/api/media/thumb`.
 */
export const GRID_THUMB_WIDTH = 384;
export const GRID_THUMB_QUALITY = 40;

/**
 * next/image `sizes` for homepage pins.
 * Keep in sync with `columnsForWidth` in archive-grid.
 */
export const GRID_IMAGE_SIZES =
  "(max-width: 539px) 50vw, (max-width: 899px) 33vw, (max-width: 1279px) 25vw, (max-width: 1679px) 20vw, 16vw";

/** First-paint detail derivative. Keep this small enough to arrive quickly. */
export const DETAIL_PREVIEW_WIDTH = 480;
export const DETAIL_PREVIEW_QUALITY = 40;

/** Viewport-sized derivative for the detail stage (not the original file). */
export const DETAIL_DISPLAY_WIDTH = 1600;
export const DETAIL_DISPLAY_QUALITY = 80;

/** True when `thumbnailUrl` is a distinct stored preview file, not the original. */
export function isStoredPreviewUrl(
  previewUrl: string,
  originalUrl: string,
): boolean {
  if (!previewUrl) return false;
  const preview = originalMediaUrl(previewUrl);
  const original = originalMediaUrl(originalUrl);
  return Boolean(preview) && preview !== original;
}

export function isStoredPreviewPath(url: string): boolean {
  if (!url) return false;
  try {
    return /-preview\.webp$/i.test(new URL(url).pathname);
  } catch {
    return /-preview\.webp$/i.test(url.split("?")[0] ?? url);
  }
}

/**
 * Homepage / card source for next/image.
 * Prefer the stored <1 MB WebP preview; fall back to the original (the
 * preview loader will then resize via `/api/media/thumb`).
 */
export function gridMediaSrc(item: ArchiveItem): string {
  if (item.mediaType === "video") {
    return item.thumbnailUrl || item.mediaUrl;
  }
  if (isStoredPreviewUrl(item.thumbnailUrl, item.mediaUrl)) {
    return originalMediaUrl(item.thumbnailUrl);
  }
  if (item.thumbnailUrl) return originalMediaUrl(item.thumbnailUrl);
  return originalMediaUrl(item.mediaUrl);
}

/** OC board source for next/image. */
export function ocGridSrc(
  oc: Pick<OriginalCharacter, "thumbnailUrl" | "mediaUrl">,
): string {
  if (isStoredPreviewUrl(oc.thumbnailUrl, oc.mediaUrl)) {
    return originalMediaUrl(oc.thumbnailUrl);
  }
  if (oc.thumbnailUrl) return originalMediaUrl(oc.thumbnailUrl);
  return originalMediaUrl(oc.mediaUrl);
}

/**
 * Native `<img>` URL for a cached lightweight WebP thumb.
 * Use when the preview is not a next/image component (filmstrip, blur-up).
 */
export function nextOptimizerSrc(
  url: string,
  width: number,
  quality: number = GRID_THUMB_QUALITY,
): string {
  if (!url) return url;
  const source = originalMediaUrl(url) || url;
  const w = Math.min(Math.max(Math.round(width), 16), 640);
  const q = Math.min(Math.max(Math.round(quality), 1), 100);
  const params = new URLSearchParams({
    url: source,
    w: String(w),
    q: String(q),
  });
  return `/api/media/thumb?${params.toString()}`;
}

/** Nested CDN URL inside `/api/media/thumb?url=…`, if this is a thumb proxy. */
export function thumbProxySource(src: string): string | null {
  if (!src) return null;
  try {
    const parsed = new URL(src, "http://local.invalid");
    if (!parsed.pathname.endsWith("/api/media/thumb")) return null;
    const nested = parsed.searchParams.get("url")?.trim() ?? "";
    return nested || null;
  } catch {
    return null;
  }
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
 * Native img — go through Next's optimizer so the first paint is not the original.
 */
export function previewAssetSrc(asset: MediaAsset): string {
  if (isStoredPreviewUrl(asset.thumbnailUrl, asset.mediaUrl)) {
    return originalMediaUrl(asset.thumbnailUrl);
  }
  const source = asset.thumbnailUrl || asset.mediaUrl;
  return nextOptimizerSrc(source, DETAIL_PREVIEW_WIDTH, DETAIL_PREVIEW_QUALITY);
}

/**
 * Collection / comic filmstrip thumb. Use the stored preview (or original)
 * on the CDN — do not proxy through `/api/media/thumb`, which often 401/502s
 * in production while localhost can still Sharp-resize the original.
 */
export function filmstripAssetSrc(asset: MediaAsset): string {
  if (isStoredPreviewUrl(asset.thumbnailUrl, asset.mediaUrl)) {
    return originalMediaUrl(asset.thumbnailUrl);
  }
  if (isStoredPreviewPath(asset.thumbnailUrl)) {
    return originalMediaUrl(asset.thumbnailUrl);
  }
  return originalMediaUrl(asset.thumbnailUrl || asset.mediaUrl);
}

export function previewMediaSrc(item: ArchiveItem): string {
  if (item.mediaType === "video") {
    return item.thumbnailUrl || item.mediaUrl;
  }
  const cover = itemMediaAssets(item)[0];
  if (cover) return previewAssetSrc(cover);
  return nextOptimizerSrc(
    item.thumbnailUrl || item.mediaUrl,
    DETAIL_PREVIEW_WIDTH,
    DETAIL_PREVIEW_QUALITY,
  );
}

/**
 * Detail display ladder: a 480px preview paints first, then a viewport-sized
 * WebP replaces it. Originals (up to 50 MB) wait until the user zooms.
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

/** Prefer smaller ladders first so first frame arrives sooner (Discord-like). */
const FAST_START_HEIGHTS = [360, 480, 240, 720, 1080] as const;

/**
 * Bunny Stream progressive MP4s appear as renditions finish encoding.
 * Try cheaper heights first so playback can start before 720p/1080p is ready.
 */
export function alternateVideoSources(mediaUrl: string): string[] {
  if (!mediaUrl) return [];

  const match = mediaUrl.match(/^(.*\/play_)(\d+)(p\.mp4)(\?.*)?$/i);
  if (!match) return [mediaUrl];

  const [, prefix, heightRaw, suffix, query = ""] = match;
  const preferred = Number(heightRaw);
  const heights: number[] = [];
  for (const height of FAST_START_HEIGHTS) {
    if (!heights.includes(height)) heights.push(height);
  }
  // Keep exotic heights available, but never ahead of the fast-start ladder.
  if (preferred > 0 && !heights.includes(preferred)) {
    heights.push(preferred);
  }

  return heights.map((height) => `${prefix}${height}${suffix}${query}`);
}

/** `…/play_720p.mp4` → `…/playlist.m3u8` (adaptive HLS). */
export function videoPlaylistUrl(mediaUrl: string): string | null {
  if (!mediaUrl) return null;
  try {
    const url = new URL(mediaUrl);
    const replaced = url.pathname.replace(
      /\/play_\d+p\.mp4$/i,
      "/playlist.m3u8",
    );
    if (replaced === url.pathname) return null;
    url.pathname = replaced;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Bunny Stream hover animation (WebP) — Discord-style pin preview. */
export function videoPreviewUrl(mediaUrl: string): string | null {
  if (!mediaUrl) return null;
  try {
    const url = new URL(mediaUrl);
    const replaced = url.pathname.replace(
      /\/play_\d+p\.mp4$/i,
      "/preview.webp",
    );
    if (replaced === url.pathname) return null;
    url.pathname = replaced;
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Playback ladder: HLS first (fast start + ABR), then progressive MP4s.
 */
export function videoPlaybackCandidates(mediaUrl: string): string[] {
  if (!mediaUrl) return [];
  const urls: string[] = [];
  const playlist = videoPlaylistUrl(mediaUrl);
  if (playlist) urls.push(playlist);
  for (const src of alternateVideoSources(mediaUrl)) {
    if (!urls.includes(src)) urls.push(src);
  }
  return urls;
}

export function isHlsUrl(url: string): boolean {
  return /\.m3u8(?:$|\?)/i.test(url);
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
