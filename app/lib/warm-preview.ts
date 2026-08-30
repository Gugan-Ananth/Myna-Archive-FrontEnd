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

/** Stash list data + warm the display-size media the detail stage will use. */
export function warmArchiveItem(item: ArchiveItem): void {
  stashItemPreview(item);
  seedItemCache(item);
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
