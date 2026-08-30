"use client";

import { seedItemCache } from "./api/archive-items";
import { seedOcCache } from "./api/original-characters";
import {
  displayAssetSrc,
  displayMediaSrc,
  itemMediaAssets,
} from "./media-display";
import { prefetchMediaUrl } from "./prefetch-media";
import { stashItemPreview, stashOcPreview } from "./preview-stash";
import type { ArchiveItem, OriginalCharacter } from "./types";

/** Stash list data + warm the display-size image the detail stage will use. */
export function warmArchiveItem(item: ArchiveItem): void {
  stashItemPreview(item);
  seedItemCache(item);
  if (item.mediaType === "video" || item.mediaType === "story") return;
  prefetchMediaUrl(displayMediaSrc(item));
  const second = itemMediaAssets(item)[1];
  if (second) prefetchMediaUrl(displayAssetSrc(second));
}

export function warmOriginalCharacter(oc: OriginalCharacter): void {
  stashOcPreview(oc);
  seedOcCache(oc);
}
