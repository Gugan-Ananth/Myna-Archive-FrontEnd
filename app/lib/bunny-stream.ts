/**
 * Bunny Stream Premium / JIT helpers.
 *
 * Just-in-Time encoding is only guaranteed with Bunny’s official player
 * (player.mediadelivery.net), not custom HLS.js / <video> players.
 * @see https://bunny.net/docs/stream/premium-encoding
 */

import { itemMediaAssets } from "./media-display";
import type { ArchiveItem } from "./types";

const VIDEO_GUID_RE =
  /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

/** Stream library ID from env (single-library personal archive). */
export function getBunnyStreamLibraryId(): string | null {
  // Must be NEXT_PUBLIC_* — this runs in the client embed component.
  const raw = process.env.NEXT_PUBLIC_BUNNY_STREAM_LIBRARY_ID?.trim() || "";
  return raw || null;
}

/** Stream video GUID from the cover asset or media URL path. */
export function bunnyStreamVideoId(item: ArchiveItem): string | null {
  const cover = itemMediaAssets(item)[0];
  if (cover?.resourceType === "video" && cover.publicId) {
    return cover.publicId;
  }
  const fromUrl = item.mediaUrl?.match(VIDEO_GUID_RE)?.[1];
  return fromUrl ?? null;
}

export type BunnyEmbedOptions = {
  autoplay?: boolean;
  muted?: boolean;
  preload?: boolean;
  /** Start at t seconds (Bunny `t` query). */
  startSeconds?: number;
};

/**
 * Official Bunny embed URL — required for Premium JIT instant playback.
 * Returns null when library/video ids are missing.
 */
export function bunnyEmbedUrl(
  videoId: string,
  options: BunnyEmbedOptions = {},
): string | null {
  const libraryId = getBunnyStreamLibraryId();
  if (!libraryId || !videoId) return null;

  const url = new URL(
    `https://player.mediadelivery.net/embed/${encodeURIComponent(libraryId)}/${encodeURIComponent(videoId)}`,
  );
  url.searchParams.set("autoplay", options.autoplay ? "true" : "false");
  url.searchParams.set("muted", options.muted ? "true" : "false");
  url.searchParams.set("preload", options.preload === false ? "false" : "true");
  url.searchParams.set("responsive", "true");
  if (options.startSeconds != null && options.startSeconds > 0) {
    url.searchParams.set("t", `${Math.floor(options.startSeconds)}s`);
  }
  return url.toString();
}

export function canUseBunnyEmbed(item: ArchiveItem): boolean {
  return Boolean(getBunnyStreamLibraryId() && bunnyStreamVideoId(item));
}
