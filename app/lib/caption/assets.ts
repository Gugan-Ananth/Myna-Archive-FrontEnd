import { itemMediaAssets } from "../media-display";
import type { ArchiveItem, MediaAsset } from "../types";
import { parseCaptionSpec } from "./types";

/** Generated still shown on grids and the detail view. */
export function captionCoverAsset(item: ArchiveItem): MediaAsset | undefined {
  return itemMediaAssets(item)[0];
}

export type CaptionSourceRef = {
  publicId: string;
  mediaUrl: string;
  width: number;
  height: number;
};

/**
 * Original photo used to regenerate the still.
 * Stored on Caption Spec, not as a second gallery asset.
 */
export function captionSourceFromItem(
  item: ArchiveItem,
): CaptionSourceRef | null {
  const spec = parseCaptionSpec(item.captionSpec);
  if (spec.sourcePublicId) {
    return {
      publicId: spec.sourcePublicId,
      mediaUrl: spec.sourceMediaUrl || "",
      width: spec.sourceWidth ?? 0,
      height: spec.sourceHeight ?? 0,
    };
  }
  const legacy = itemMediaAssets(item)[1];
  if (!legacy) return null;
  return {
    publicId: legacy.publicId,
    mediaUrl: legacy.mediaUrl,
    width: legacy.width ?? 0,
    height: legacy.height ?? 0,
  };
}
