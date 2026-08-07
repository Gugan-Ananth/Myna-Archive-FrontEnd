/** Media kind stored in the archive. */
export type MediaType = "image" | "video";

/** One uploaded binary within an Archive Item (cover or carousel slide). */
export type MediaAsset = {
  publicId: string;
  resourceType: "image" | "video";
  mediaUrl: string;
  thumbnailUrl: string;
  width: number | null;
  height: number | null;
  blurHash: string | null;
};

/** A single archived media item (image, image group, or video). */
export type ArchiveItem = {
  id: string;
  name: string;
  description: string;
  /**
   * Tags as encoded `category:tag` pairs (e.g. `bondage:hogtie`).
   * Legacy freeform strings without `:` are still accepted (Uncategorized).
   */
  tags: string[];
  /** Decimal score 0.0–10.0; higher ranks first on the home grid. */
  rating: number;
  /** Whether this item is an image or a video. */
  mediaType: MediaType;
  /** Cover thumbnail for the home grid (first media asset). */
  thumbnailUrl: string;
  /**
   * Cover full media source.
   * Image URL for images; playable video file URL for videos.
   */
  mediaUrl: string;
  /** Pixel width of cover media; null when unknown (legacy / encoding). */
  width: number | null;
  /** Pixel height of cover media; null when unknown. */
  height: number | null;
  /** Compact BlurHash for cover LQIP; null when unknown. */
  blurHash: string | null;
  /**
   * Ordered media assets. Length 1 for single image/video;
   * 2–10 for an image group (cover is always index 0).
   */
  mediaAssets: MediaAsset[];
};

/** Max images in one image-group Archive Item (ADR 0009). */
export const MAX_IMAGE_ASSETS = 10;

/** Collection-wide tag vocabulary entry from `GET /api/v1/tags`. */
export type TagSummary = {
  tag: string;
  count: number;
};

/** One tag under a category from `GET /api/v1/taxonomy`. */
export type TaxonomyTagDto = {
  slug: string;
  label: string;
  builtIn: boolean;
  count: number;
};

/** Category with nested tags from `GET /api/v1/taxonomy`. */
export type TaxonomyCategoryDto = {
  slug: string;
  label: string;
  builtIn: boolean;
  tags: TaxonomyTagDto[];
};
