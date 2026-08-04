import type { ArchiveItem } from "./types";

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
 * Homepage grid source.
 * Feed this to `next/image` so the Next optimizer can serve **WebP** (fast).
 * Do not use on the detail page — that must stay the original file format.
 */
export function gridMediaSrc(item: ArchiveItem): string {
  if (item.mediaType === "video") {
    return item.thumbnailUrl || item.mediaUrl;
  }
  // Original URL as input; Next/Image re-encodes to WebP/AVIF at display size.
  return originalMediaUrl(item.mediaUrl || item.thumbnailUrl);
}

/**
 * Detail / zoom: original uploaded file (jpg/png/…), no Next optimizer, no WebP.
 * Render with a native `<img>` so the browser loads the real asset bytes.
 */
export function detailMediaSrc(item: ArchiveItem): string {
  return originalMediaUrl(item.mediaUrl);
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
