"use client";

import { seedItemCache } from "./api/archive-items";
import { seedOcCache } from "./api/original-characters";
import {
  displayAssetSrc,
  displayMediaSrc,
  itemMediaAssets,
  videoPlaybackCandidates,
  videoPreviewUrl,
} from "./media-display";
import { prefetchMediaUrl, prefetchVideoUrl } from "./prefetch-media";
import { stashItemPreview, stashOcPreview } from "./preview-stash";
import type { ArchiveItem, OriginalCharacter } from "./types";

/**
 * Cache list data immediately; only warm detail media for an intentional
 * interaction so moving across a grid cannot start many large downloads.
 */
export function warmArchiveItem(
  item: ArchiveItem,
  options: { prefetchMedia?: boolean } = {},
): void {
  stashItemPreview(item);
  seedItemCache(item);
  if (options.prefetchMedia === false) return;
  if (item.mediaType === "story") return;
  if (item.mediaType === "video") {
    if (item.thumbnailUrl) prefetchMediaUrl(item.thumbnailUrl);
    const preview = videoPreviewUrl(item.mediaUrl);
    if (preview) prefetchMediaUrl(preview);
    const first = videoPlaybackCandidates(item.mediaUrl)[0];
    if (first) prefetchVideoUrl(first);
    return;
  }
  prefetchMediaUrl(displayMediaSrc(item));
  const second = itemMediaAssets(item)[1];
  if (second) prefetchMediaUrl(displayAssetSrc(second));
}

export function warmOriginalCharacter(oc: OriginalCharacter): void {
  stashOcPreview(oc);
  seedOcCache(oc);
}
