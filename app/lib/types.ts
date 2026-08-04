/** Media kind stored in the archive. */
export type MediaType = "image" | "video";

/** A single archived media item (image or video) in the personal collection. */
export type ArchiveItem = {
  id: string;
  name: string;
  description: string;
  /** Freeform hashtag-style tags (no fixed vocabulary). */
  tags: string[];
  /** Decimal score 0.0–10.0; higher ranks first on the home grid. */
  rating: number;
  /** Whether this item is an image or a video. */
  mediaType: MediaType;
  /** Low-res thumbnail for the home grid (still frame for videos). */
  thumbnailUrl: string;
  /**
   * Full media source for the detail viewer.
   * Image URL for images; playable video file URL for videos.
   */
  mediaUrl: string;
};
