/** Media kind stored in the archive. */
export type MediaType = "image" | "video" | "story" | "comic";

export const ARCHIVE_SECTIONS = ["images", "cute-things"] as const;
export type ArchiveSection = (typeof ARCHIVE_SECTIONS)[number];

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

/** A single archived media item (image, image group, video, story, or comic). */
export type ArchiveItem = {
  id: string;
  name: string;
  description: string;
  /** Written story HTML; empty/omitted for image/video. */
  bodyHtml?: string;
  /** Optional author name for written stories. */
  author?: string;
  /** Optional short blurb for story homepage cards. */
  summary?: string;
  /**
   * Tags as encoded `category:tag` pairs (e.g. `bondage:hogtie`).
   * Legacy freeform strings without `:` are still accepted (Uncategorized).
   */
  tags: string[];
  /** Decimal score 0.0–10.0; higher ranks first on the home grid. */
  rating: number;
  /** Whether this item is an image, a video, a written story, or a comic. */
  mediaType: MediaType;
  /** Whether this item is starred within its dashboard category. */
  starred?: boolean;
  /** Top-level archive section for this item. */
  section?: ArchiveSection;
  /** Root story id when this row is a later chapter; null for the series. */
  seriesId?: string | null;
  /** 1-based chapter index. Roots are chapter 1. */
  chapterNumber?: number;
  /** How many chapters the series has (on story roots). */
  chapterCount?: number;
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
   * 2–25 for an image group; 1–80 for a comic (cover is always index 0).
   */
  mediaAssets: MediaAsset[];
};

/** Min images in one image-group Archive Item. */
export const MIN_IMAGE_GROUP_ASSETS = 2;

/** Max images in one image-group Archive Item. */
export const MAX_IMAGE_ASSETS = 25;

/** Max pages in one comic Archive Item (ADR 0012). */
export const MAX_COMIC_ASSETS = 80;

/** Max inline images in one written story. */
export const MAX_STORY_ASSETS = 20;

/** Max story `bodyHtml` characters. Must match backend `MAX_STORY_BODY_CHARS`. */
export const MAX_STORY_BODY_CHARS = 200_000;

/** An original character (OC) sheet — portrait plus profile fields. */
export type OriginalCharacter = {
  id: string;
  name: string;
  age: string;
  likes: string;
  dislikes: string;
  background: string;
  additionalInfo: string;
  /** Whether this OC is starred within the OC category. */
  starred?: boolean;
  publicId: string;
  thumbnailUrl: string;
  mediaUrl: string;
  width: number | null;
  height: number | null;
  blurHash: string | null;
};

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
